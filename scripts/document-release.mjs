import assert from 'node:assert/strict';
import { stagingDatabase } from './staging/connection.mjs';
import { validateMigrations } from './staging/prepare.mjs';
assert.equal(process.argv[2], 'migrate-staging');
const migration = validateMigrations('supabase/migrations').find(
  (m) => m.file === '20260920001200_document_versions.sql',
);
assert(migration);
const db = await stagingDatabase();
try {
  await db.query('begin');
  await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
  const prior = await db.query(
    "select statements from supabase_migrations.schema_migrations where version='20260920001200'",
  );
  if (prior.rows.length) assert.equal(prior.rows[0].statements.join('\n'), migration.sql);
  else {
    await db.query(migration.sql);
    await db.query(
      'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
      ['20260920001200', 'document_versions', [migration.sql]],
    );
  }
  const checks = (
    await db.query(`select
    has_table_privilege('authenticated','public.document_versions','UPDATE') as direct_update,
    has_table_privilege('anon','public.document_versions','SELECT') as anon_read,
    has_function_privilege('authenticated','public.finish_document_scan(uuid,text,text,text)','EXECUTE') as browser_scan,
    has_function_privilege('service_role','public.finish_document_scan(uuid,text,text,text)','EXECUTE') as worker_scan,
    (select public from storage.buckets where id='company-private') as public_bucket,
    (select count(*)::int from pg_policies where schemaname='storage' and tablename='objects') as storage_policies`)
  ).rows[0];
  assert.deepEqual(checks, {
    direct_update: false,
    anon_read: false,
    browser_scan: false,
    worker_scan: true,
    public_bucket: false,
    storage_policies: 0,
  });
  await db.query('commit');
  console.log(
    'Staging migration 012 installed; checksum and grants verified. Production unchanged.',
  );
} catch (error) {
  await db.query('rollback').catch(() => {});
  console.error('Document migration failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
