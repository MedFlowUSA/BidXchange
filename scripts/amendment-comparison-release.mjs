import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';
import { stagingDatabase } from './staging/connection.mjs';
import { validateMigrations } from './staging/prepare.mjs';
const target = process.argv[2];
assert(['staging', 'production'].includes(target));
assert.equal(process.argv[3], 'apply-approved');
assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
const files = validateMigrations('supabase/migrations').filter(
  (m) => m.file === '20260922003200_amendment_comparison.sql',
);
assert.equal(files.length, 1, 'Reviewed migration 032 must be present');
let db;
try {
  if (target === 'production')
    assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
  db = target === 'staging' ? await stagingDatabase() : await connectDatabase();
  await db.query('begin');
  await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
  await db.query('select pg_advisory_xact_lock(20260922,32)');
  const installed = (
    await db.query('select version,statements from supabase_migrations.schema_migrations')
  ).rows;
  for (const version of [
    '20260919000100',
    '20260921001500',
    '20260921002100',
    '20260922002800',
    '20260922002900',
    '20260922003000',
    '20260922003100',
  ])
    assert(
      installed.some((m) => m.version === version),
      'Missing prerequisite',
    );
  if (target === 'production')
    for (const version of ['20260921001700', '20260921001800', '20260921001900'])
      assert(
        installed.some((m) => m.version === version),
        'Missing production prerequisite',
      );
  const tables = [
    'opportunity_amendments',
    'company_profiles',
    'onboarding_items',
    'profile_facts',
    'pursuits',
    'pursuit_requirements',
    'pursuit_tasks',
    'pursuit_decision_history',
    'opportunities',
    'proposal_sections',
    'response_release_versions',
    'organization_memberships',
    'evidence_use_reviews',
    'requirement_resolution_history',
    'requirements_register_signoffs',
    'ai_organization_settings',
  ];
  await db.query(
    'lock table ' + tables.map((t) => 'public.' + t).join(',') + ' in share row exclusive mode',
  );
  const columns = {};
  for (const table of tables)
    columns[table] = (
      await db.query(
        "select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",
        [table],
      )
    ).rows.map((r) => r.column_name);
  const snapshot = async () => {
    const records = {};
    for (const table of tables)
      records[table] = (
        await db.query(
          `select count(*)::int n,md5(coalesce(string_agg((select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(t)) where key=any($1::text[]))::text,'' order by to_jsonb(t)->>'id'),'')) digest from public.${table} t`,
          [columns[table]],
        )
      ).rows[0];
    return records;
  };
  const before = await snapshot();
  const applied = [];
  for (const migration of files) {
    const version = migration.file.slice(0, 14),
      prior = installed.find((m) => m.version === version);
    if (prior) {
      assert.equal(
        prior.statements.join('\n').replace(/\r\n/g, '\n'),
        migration.sql,
        'Installed migration differs',
      );
      continue;
    }
    await db.query(migration.sql);
    await db.query(
      'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
      [version, migration.file.slice(15, -4), [migration.sql]],
    );
    applied.push(version);
  }
  assert.deepEqual(await snapshot(), before, 'Existing records changed');
  const withoutRls = (
    await db.query(
      "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    )
  ).rows;
  assert.deepEqual(withoutRls, [], 'A public table lacks RLS');
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('authenticated','private.record_pursuit_decision(uuid,uuid,timestamptz,text,text,text,text)','EXECUTE') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  await db.query("notify pgrst,'reload schema'");
  await db.query('commit');
  console.log(
    JSON.stringify({ target, applied, existingRecordsPreserved: true, rlsEnabled: true }),
  );
} catch (error) {
  await db?.query('rollback').catch(() => {});
  console.error(
    'Amendment comparison migration failed and transaction rolled back. Code: ' +
      (typeof error?.code === 'string' ? error.code : 'VALIDATION') +
      '; ' +
      (error instanceof assert.AssertionError ? error.message : 'Provider details withheld.'),
  );
  process.exitCode = 1;
} finally {
  await db?.end();
}
