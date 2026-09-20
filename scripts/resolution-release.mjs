import assert from 'node:assert/strict';
import { stagingDatabase } from './staging/connection.mjs';
import { validateMigrations } from './staging/prepare.mjs';
assert.equal(process.argv[2], 'migrate-staging');
const migration = validateMigrations('supabase/migrations').find(
  (m) => m.file === '20260920001100_requirement_resolutions.sql',
);
assert(migration);
const db = await stagingDatabase();
try {
  await db.query('begin');
  await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
  const prior = await db.query(
    "select statements from supabase_migrations.schema_migrations where version='20260920001100'",
  );
  if (prior.rowCount) assert.equal(prior.rows[0].statements.join('\n'), migration.sql);
  else {
    await db.query(migration.sql);
    await db.query(
      'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
      ['20260920001100', 'requirement_resolutions', [migration.sql]],
    );
  }
  const permissions = (
    await db.query(
      "select has_table_privilege('anon','public.current_requirement_resolutions','SELECT') anon_read,has_column_privilege('authenticated','public.requirement_resolution_history','evidence_review_id','SELECT') private_link,has_table_privilege('authenticated','public.requirement_resolution_history','INSERT') direct_write,has_table_privilege('authenticated','public.current_requirement_resolutions','SELECT') summary_read",
    )
  ).rows[0];
  assert.deepEqual(permissions, {
    anon_read: false,
    private_link: false,
    direct_write: false,
    summary_read: true,
  });
  await db.query('commit');
  console.log(
    'Staging migration 011 installed; checksum and permission checks passed. Production unchanged.',
  );
} catch (error) {
  await db.query('rollback').catch(() => {});
  console.error('Resolution staging release failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
