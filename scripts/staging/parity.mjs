import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { stagingDatabase, stagingRef } from './connection.mjs';
import { localTestDatabase } from '../local-test-db.mjs';
const db = await stagingDatabase(),
  local = await localTestDatabase({ includeCompanySeed: false });
await local.query(readFileSync('supabase/migrations/20260919000500_ai_readonly.sql', 'utf8'));
await local.query('create role service_role');
await local.query(readFileSync('supabase/migrations/20260919000600_demo_intake.sql', 'utf8'));
await local.query(
  readFileSync('supabase/migrations/20260919000700_evidence_use_reviews.sql', 'utf8'),
);
await local.query(
  readFileSync('supabase/migrations/20260919000800_evidence_review_grants.sql', 'utf8'),
);
await local.query(
  readFileSync('supabase/migrations/20260919000900_evidence_review_conflict.sql', 'utf8'),
);
await local.query(readFileSync('supabase/migrations/20260920001000_pursuit_decisions.sql', 'utf8'));
await local.query(
  readFileSync('supabase/migrations/20260920001100_requirement_resolutions.sql', 'utf8'),
);
await local.query(readFileSync('supabase/migrations/20260920001200_document_versions.sql', 'utf8'));
const queries = {
  views: `select c.relname,c.reloptions,pg_get_viewdef(c.oid) definition from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' order by c.relname`,
  columnGrants: `select table_name,column_name,grantee,privilege_type from information_schema.column_privileges where table_schema='public' and table_name in ('evidence_use_reviews','pursuits','pursuit_decision_history','requirement_resolution_history') and grantee in ('anon','authenticated','PUBLIC') order by table_name,column_name,grantee,privilege_type`,
  columns: `select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
  policies: `select tablename,policyname,roles::text,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname`,
  functions: `select n.nspname,p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' or (n.nspname='public' and p.proname in ('reserve_ai_request','ai_feedback','is_demo_operator','submit_demo_request','review_demo_request','erase_demo_request','pursuit_decision_context','record_pursuit_decision','resolve_pursuit_requirement','reserve_document_version','confirm_document_upload','finish_document_scan','link_requirement_document')) order by p.proname`,
  constraints: `select c.relname,k.conname,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and k.contype <> 'n' order by c.relname,k.conname`,
  grants: `select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','PUBLIC') order by table_name,grantee,privilege_type`,
  triggers: `select c.relname,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname`,
  rls: `select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname`,
};
const report = { project: stagingRef, comparisons: {} };
try {
  for (const [name, sql] of Object.entries(queries)) {
    const actual = (await db.query(sql)).rows,
      expected = (await local.query(sql)).rows;
    assert.deepEqual(actual, expected, name + ' schema parity');
    report.comparisons[name] = { matches: true, rows: actual.length };
  }
  assert.deepEqual(
    (
      await db.query('select version from supabase_migrations.schema_migrations order by version')
    ).rows.map((r) => r.version),
    [
      '20260919000100',
      '20260919000300',
      '20260919000400',
      '20260919000500',
      '20260919000600',
      '20260919000700',
      '20260919000800',
      '20260919000900',
      '20260920001000',
      '20260920001100',
      '20260920001200',
    ],
  );
  assert.deepEqual(
    (await db.query("select public from storage.buckets where id='company-private'")).rows,
    [{ public: false }],
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from pg_policies where schemaname='storage' and tablename='objects'",
      )
    ).rows[0].n,
    0,
  );
  writeFileSync('.tmp/staging-parity-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.end();
  await local.end();
}
