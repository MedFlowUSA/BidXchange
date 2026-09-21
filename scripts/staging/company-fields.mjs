import assert from 'node:assert/strict';
import { stagingDatabase } from './connection.mjs';
import { validateMigrations } from './prepare.mjs';
assert.equal(process.argv[2], 'apply-reviewed-staging');
const migration = validateMigrations('supabase/migrations').find(
  (m) => m.file === '20260921001600_structured_company_profiles.sql',
);
assert(migration);
const db = await stagingDatabase();
try {
  await db.query('begin');
  await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
  const prior = await db.query(
    "select statements from supabase_migrations.schema_migrations where version='20260921001600'",
  );
  if (prior.rowCount) assert.equal(prior.rows[0].statements.join('\n'), migration.sql);
  else {
    await db.query(migration.sql);
    await db.query(
      'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
      ['20260921001600', 'structured_company_profiles', [migration.sql]],
    );
  }
  const checks = (
    await db.query("select relrowsecurity from pg_class where oid='public.profile_facts'::regclass")
  ).rows[0];
  assert.equal(checks.relrowsecurity, true);
  assert.equal(
    (await db.query("select has_table_privilege('anon','public.profile_facts','SELECT') allowed"))
      .rows[0].allowed,
    false,
  );
  await db.query('commit');
  console.log(
    'Staging migration 016 applied; RLS and anonymous-read denial retained. Production unchanged.',
  );
} catch (e) {
  await db.query('rollback');
  console.error('Staging structured profile migration failed:', e.code ?? e.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
