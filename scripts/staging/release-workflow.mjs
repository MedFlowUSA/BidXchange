import assert from 'node:assert/strict';
import { stagingDatabase } from './connection.mjs';
import { validateMigrations } from './prepare.mjs';
assert.equal(process.argv[2], 'apply-reviewed-staging', 'Explicit staging-only action required');
const migration = validateMigrations('supabase/migrations').find(
  (m) => m.file === '20260921001500_response_release_workflow.sql',
);
assert(migration);
const db = await stagingDatabase();
try {
  await db.query('begin');
  await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
  const prior = await db.query(
    "select statements from supabase_migrations.schema_migrations where version='20260921001500'",
  );
  if (prior.rowCount) {
    const installed = prior.rows[0].statements.join('\n');
    if (installed !== migration.sql) {
      // Pre-release staging iteration only. Never rewrite a production migration.
      // Refuse any populated history or structural change; only reviewed function bodies can change.
      for (const table of [
        'response_release_versions',
        'response_approval_history',
        'response_submission_history',
        'response_followup_history',
      ])
        assert.equal(
          (
            await db.query(
              `select count(*)::int n from public.${table} h join public.organizations o on o.id=h.organization_id where o.status<>'suspended' or o.slug not like 'staging-release-%'`,
            )
          ).rows[0].n,
          0,
          'Non-quarantined staging history exists; use an additive migration',
        );
      const pattern = /create function public\.[\s\S]*?\$\$;/g;
      assert.equal(
        installed.replace(pattern, ''),
        migration.sql.replace(pattern, ''),
        'Structural migration changes require an additive migration',
      );
      for (const definition of migration.sql.match(pattern) ?? [])
        await db.query(definition.replace('create function', 'create or replace function'));
      await db.query(
        "update supabase_migrations.schema_migrations set statements=$1 where version='20260921001500'",
        [[migration.sql]],
      );
    }
  } else {
    await db.query(migration.sql);
    await db.query(
      'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
      ['20260921001500', 'response_release_workflow', [migration.sql]],
    );
  }
  const checks = (
    await db.query(
      "select has_table_privilege('anon','public.response_release_versions','SELECT') anon_read,has_table_privilege('authenticated','public.response_approval_history','INSERT') direct_write,has_table_privilege('authenticated','public.response_release_versions','SELECT') member_read",
    )
  ).rows[0];
  assert.deepEqual(checks, { anon_read: false, direct_write: false, member_read: true });
  await db.query('commit');
  console.log(
    'Staging-only release migration applied; checksum and base permissions verified. Production unchanged.',
  );
} catch (e) {
  await db.query('rollback');
  console.error('Staging migration failed:', e.code ?? e.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
