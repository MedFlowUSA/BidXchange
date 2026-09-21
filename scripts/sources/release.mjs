import assert from 'node:assert/strict';
import { stagingDatabase } from '../staging/connection.mjs';
import { validateMigrations } from '../staging/prepare.mjs';

// Exact staging target only; no production migration or feature activation.
assert.equal(process.argv[2], 'migrate-staging');
const migration = validateMigrations('supabase/migrations').find(
  (m) => m.file === '20260920001300_opportunity_sources.sql',
);
assert(migration);
const db = await stagingDatabase();
let second;
try {
  await db.query('begin');
  await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
  const prior = await db.query(
    "select statements from supabase_migrations.schema_migrations where version='20260920001300'",
  );
  if (prior.rows.length) assert.equal(prior.rows[0].statements.join('\n'), migration.sql);
  else {
    await db.query(migration.sql);
    await db.query(
      'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',
      ['20260920001300', 'opportunity_sources', [migration.sql]],
    );
  }
  const checks = (
    await db.query(`select
    (select enabled from public.procurement_sources where id='sam.gov') as enabled,
    has_table_privilege('anon','public.source_records','SELECT') as anonymous_read,
    has_table_privilege('authenticated','public.source_inbox','UPDATE') as direct_review,
    has_column_privilege('authenticated','public.source_record_versions','raw_snapshot','SELECT') as raw_read,
    has_function_privilege('anon','public.review_source_item(uuid,uuid,timestamptz,uuid,text,text,uuid,boolean)','EXECUTE') as anonymous_review,
    (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('procurement_sources','source_sync_runs','source_sync_items','source_operator_events','source_records','source_record_versions','opportunity_searches','source_inbox') and c.relrowsecurity) as rls_tables`)
  ).rows[0];
  assert.deepEqual(checks, {
    enabled: false,
    anonymous_read: false,
    direct_review: false,
    raw_read: false,
    anonymous_review: false,
    rls_tables: 8,
  });
  await db.query('commit');
  second = await stagingDatabase();
  assert.equal(
    (await db.query('select pg_try_advisory_lock(1396788551) as locked')).rows[0].locked,
    true,
  );
  assert.equal(
    (await second.query('select pg_try_advisory_lock(1396788551) as locked')).rows[0].locked,
    false,
  );
  await db.query('select pg_advisory_unlock(1396788551)');
  assert.equal(
    (await second.query('select pg_try_advisory_lock(1396788551) as locked')).rows[0].locked,
    true,
  );
  await second.query('select pg_advisory_unlock(1396788551)');
  console.log(
    'Staging migration 013 installed; exact checksum, eight RLS tables, restricted grants and independent-session locking verified. Sync remains disabled. Production unchanged.',
  );
} catch (error) {
  await db.query('rollback').catch(() => {});
  console.error('Staging source release failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await second?.end();
  await db.end();
}
