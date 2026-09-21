import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { connectDatabase } from './db.mjs';
import { validateMigrations } from './staging/prepare.mjs';
const mode = process.argv[2];
assert(['preflight', 'apply-approved'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
const migration = validateMigrations('supabase/migrations').find(
  (m) => m.file === '20260921001500_response_release_workflow.sql',
);
assert.equal(
  createHash('sha256').update(migration.sql).digest('hex'),
  '71a4317a9170e7e715df22b46c1aaa0db7e17a8fb4f1ecd223606c2f641ac7c7',
  'Only the explicitly approved migration is allowed',
);
const db = await connectDatabase();
try {
  assert(
    db.connectionParameters.host === 'db.bcrxejydosltquspsutw.supabase.co' ||
      db.connectionParameters.user.endsWith('.bcrxejydosltquspsutw'),
  );
  const installed = (
    await db.query(
      'select version,name,statements from supabase_migrations.schema_migrations order by version',
    )
  ).rows;
  const manifest = JSON.parse(readFileSync('scripts/staging/migrations.json', 'utf8'));
  const prerequisite = manifest.migrations.filter((m) => m.file < '20260920001200');
  for (const p of prerequisite)
    assert(
      installed.some((m) => m.version === p.file.slice(0, 14)),
      `Missing prerequisite ${p.file}`,
    );
  const checks = prerequisite.map((p) => {
    const row = installed.find((m) => m.version === p.file.slice(0, 14));
    const recorded = (row.statements ?? []).join('\n').replace(/\r\n/g, '\n');
    return {
      version: row.version,
      exactStoredSql: recorded
        ? createHash('sha256').update(recorded).digest('hex') === p.sha256
        : null,
    };
  });
  const baseline = {
    checked_at: new Date().toISOString(),
    migration_inventory: installed.map((m) => ({ version: m.version, name: m.name })),
    prerequisite_checks: checks,
    storage_policies: (
      await db.query(
        "select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='storage'",
      )
    ).rows,
    ai_settings: (
      await db.query('select organization_id,enabled from public.ai_organization_settings')
    ).rows,
  };
  mkdirSync('.tmp/response-production', { recursive: true });
  writeFileSync('.tmp/response-production/preflight.json', JSON.stringify(baseline, null, 2));
  console.log(
    JSON.stringify({
      target: 'production',
      prerequisites: checks,
      storagePolicyCount: baseline.storage_policies.length,
      mode,
    }),
  );
  if (mode === 'preflight') process.exitCode = 0;
  else {
    await db.query('begin');
    await db.query("set local lock_timeout='5s';set local statement_timeout='30s'");
    const prior = installed.find((m) => m.version === '20260921001500');
    if (prior)
      assert.equal(prior.statements.join('\n'), migration.sql, 'Installed migration differs');
    else {
      await db.query(migration.sql);
      await db.query(
        'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
        ['20260921001500', 'response_release_workflow', [migration.sql]],
      );
    }
    for (const table of [
      'response_release_versions',
      'response_approval_history',
      'response_submission_history',
      'response_followup_history',
    ]) {
      const grants = (
        await db.query(
          "select has_table_privilege('anon',$1,'SELECT') anon_read,has_table_privilege('authenticated',$1,'INSERT') direct_insert,has_table_privilege('authenticated',$1,'UPDATE') direct_update,has_table_privilege('authenticated',$1,'DELETE') direct_delete,has_table_privilege('authenticated',$1,'SELECT') member_read",
          ['public.' + table],
        )
      ).rows[0];
      assert.deepEqual(grants, {
        anon_read: false,
        direct_insert: false,
        direct_update: false,
        direct_delete: false,
        member_read: true,
      });
      assert(
        (
          await db.query('select relrowsecurity from pg_class where oid=$1::regclass', [
            'public.' + table,
          ])
        ).rows[0].relrowsecurity,
      );
    }
    const rpcs = (
      await db.query(
        "select proname,has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,has_function_privilege('authenticated',p.oid,'EXECUTE') member_exec from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname=any($1)",
        [
          [
            'response_release_context',
            'freeze_response_release',
            'response_release_status',
            'record_response_approval',
            'record_response_submission',
            'record_response_followup',
          ],
        ],
      )
    ).rows;
    assert.equal(rpcs.length, 6);
    assert(rpcs.every((p) => !p.anon_exec && p.member_exec));
    assert.deepEqual(
      (
        await db.query(
          "select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='storage'",
        )
      ).rows,
      baseline.storage_policies,
    );
    assert.deepEqual(
      (await db.query('select organization_id,enabled from public.ai_organization_settings')).rows,
      baseline.ai_settings,
    );
    await db.query('commit');
    console.log(
      'APPROVED MIGRATION APPLIED: four RLS histories and six RPCs verified; storage and AI activation unchanged.',
    );
  }
} catch (error) {
  await db.query('rollback').catch(() => {});
  console.error(
    'Production release stopped:',
    error.code === 'ERR_ASSERTION' ? error.message : (error.code ?? error.name),
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
