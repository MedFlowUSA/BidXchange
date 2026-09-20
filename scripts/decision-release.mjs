import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';
import { stagingDatabase } from './staging/connection.mjs';
import { validateMigrations } from './staging/prepare.mjs';

// Production application requires a separately approved named migration release.
const mode = process.argv[2];
assert(['migrate-staging', 'migrate-production'].includes(mode));
const production = mode === 'migrate-production';
if (production) {
  assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
  assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
}
const migrations = validateMigrations('supabase/migrations').filter(
  (m) => m.file === '20260920001000_pursuit_decisions.sql',
);
assert.equal(migrations.length, 1);
const db = production ? await connectDatabase() : await stagingDatabase();
try {
  if (production)
    assert(
      db.connectionParameters.host === 'db.bcrxejydosltquspsutw.supabase.co' ||
        db.connectionParameters.user.endsWith('.bcrxejydosltquspsutw'),
    );
  await db.query('begin');
  await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
  for (const migration of migrations) {
    const version = migration.file.slice(0, 14),
      name = migration.file.slice(15, -4);
    const prior = await db.query(
      'select statements from supabase_migrations.schema_migrations where version=$1',
      [version],
    );
    if (prior.rowCount) assert.equal(prior.rows[0].statements.join('\n'), migration.sql);
    else {
      await db.query(migration.sql);
      await db.query(
        'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
        [version, name, [migration.sql]],
      );
    }
  }
  const checks = await db.query(`select
    (select relrowsecurity from pg_class where oid='public.pursuit_decision_history'::regclass) as rls,
    has_table_privilege('authenticated','public.pursuit_decision_history','SELECT') as member_read,
    has_table_privilege('authenticated','public.pursuit_decision_history','INSERT') as direct_insert,
    has_table_privilege('authenticated','public.pursuit_decision_history','UPDATE') as direct_update,
    has_table_privilege('authenticated','public.pursuit_decision_history','DELETE') as direct_delete,
    has_table_privilege('anon','public.pursuit_decision_history','SELECT') as anon_read,
    has_column_privilege('authenticated','public.pursuits','decision','UPDATE') as direct_decision,
    has_column_privilege('authenticated','public.pursuits','title','UPDATE') as title_edit,
    has_function_privilege('anon','public.record_pursuit_decision(uuid,uuid,timestamptz,text,text,text,text)','EXECUTE') as anon_execute,
    has_function_privilege('authenticated','public.record_pursuit_decision(uuid,uuid,timestamptz,text,text,text,text)','EXECUTE') as member_execute`);
  assert.deepEqual(checks.rows[0], {
    rls: true,
    member_read: true,
    direct_insert: false,
    direct_update: false,
    direct_delete: false,
    anon_read: false,
    direct_decision: false,
    title_edit: true,
    anon_execute: false,
    member_execute: true,
  });
  await db.query('commit');
  console.log(
    JSON.stringify({
      target: production ? 'production' : 'staging',
      migrations: ['010'],
      installed: true,
      checksumVerified: true,
      permissionChecksPassed: true,
    }),
  );
} catch (error) {
  await db.query('rollback').catch(() => {});
  console.error('Decision migration failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
