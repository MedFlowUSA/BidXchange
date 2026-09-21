import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { connectDatabase } from './db.mjs';
import { validateMigrations } from './staging/prepare.mjs';
assert.equal(process.argv[2], 'apply-approved');
assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
const ref = 'bcrxejydosltquspsutw';
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), ref);
const migration = validateMigrations('supabase/migrations').find(
  (m) => m.file === '20260921001600_structured_company_profiles.sql',
);
assert(migration);
assert.equal(
  createHash('sha256').update(migration.sql).digest('hex'),
  '7590671c5f3ac55ee7fb1a1c1a0d029de2b1297c1e49cf3de9db465bfddcdafa',
);
const db = await connectDatabase();
try {
  assert(
    db.connectionParameters.host === `db.${ref}.supabase.co` ||
      db.connectionParameters.user.endsWith(`.${ref}`),
  );
  await db.query('begin');
  await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
  await db.query('lock table public.profile_facts in share row exclusive mode');
  const installed = (
    await db.query('select version,statements from supabase_migrations.schema_migrations')
  ).rows;
  for (const version of ['20260919000100', '20260919000500', '20260921001500'])
    assert(
      installed.some((m) => m.version === version),
      'Missing prerequisite',
    );
  const snapshot = async () => ({
    facts: (
      await db.query(
        "select count(*)::int n,md5(coalesce(string_agg((to_jsonb(f)-'structured_kind'-'structured_fields')::text,'' order by id),'')) digest from public.profile_facts f",
      )
    ).rows,
    policies: (
      await db.query(
        "select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where (schemaname='public' and tablename='profile_facts') or schemaname='storage' order by schemaname,tablename,policyname",
      )
    ).rows,
    ai: (
      await db.query(
        'select organization_id,enabled from public.ai_organization_settings order by organization_id',
      )
    ).rows,
  });
  const before = await snapshot();
  const prior = installed.find((m) => m.version === '20260921001600');
  if (prior) assert.equal(prior.statements.join('\n'), migration.sql);
  else {
    await db.query(migration.sql);
    await db.query(
      'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
      ['20260921001600', 'structured_company_profiles', [migration.sql]],
    );
  }
  assert.deepEqual(
    await snapshot(),
    before,
    'Existing company values, policies or AI activation changed',
  );
  assert.equal(
    (
      await db.query(
        "select relrowsecurity from pg_class where oid='public.profile_facts'::regclass",
      )
    ).rows[0].relrowsecurity,
    true,
  );
  assert.equal(
    (await db.query("select has_table_privilege('anon','public.profile_facts','SELECT') allowed"))
      .rows[0].allowed,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from pg_trigger where tgrelid='public.profile_facts'::regclass and tgname='aa_structured_fact' and tgenabled='O'",
      )
    ).rows[0].n,
    1,
  );
  await db.query('commit');
  console.log(
    'Production migration 016 applied and verified. Existing fact values, RLS policies, storage policies and AI activation unchanged.',
  );
} catch (e) {
  await db.query('rollback');
  console.error('Production structured migration failed:', e.code ?? e.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
