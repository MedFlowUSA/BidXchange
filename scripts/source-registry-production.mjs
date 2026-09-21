import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { connectDatabase } from './db.mjs';
assert.equal(process.argv[2],'apply-approved');
assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
const ref='bcrxejydosltquspsutw';
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),ref);
const migrations=[
 ['20260921001700','source_registry','e05f97b4b8cb2fb28ec68ac8dd089d4879208a7a597d9e55ee0024fbb087f8ea'],
 ['20260921001800','company_source_capabilities','b2152579b1bbba234f27f283747813cff64ef84c527ee89231bd28d72296d78d'],
].map(([version,name,hash])=>{const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');assert.equal(createHash('sha256').update(sql).digest('hex'),hash);return{version,name,sql};});
const db=await connectDatabase();
try {
 assert(db.connectionParameters.host===`db.${ref}.supabase.co` || db.connectionParameters.user.endsWith(`.${ref}`));
 await db.query('begin'); await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
 const installed=(await db.query('select version,statements from supabase_migrations.schema_migrations')).rows;
 assert(installed.some(m=>m.version==='20260921001600'));
 const snapshot=async()=>({
  opportunities:(await db.query("select count(*)::int n,md5(coalesce(string_agg((to_jsonb(o)-'source_details')::text,'' order by id),'')) digest from public.opportunities o")).rows,
  facts:(await db.query("select count(*)::int n,md5(coalesce(string_agg(to_jsonb(f)::text,'' order by id),'')) digest from public.profile_facts f")).rows,
  ai:(await db.query('select organization_id,enabled from public.ai_organization_settings order by organization_id')).rows,
  policies:(await db.query("select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('opportunities','profile_facts') order by tablename,policyname")).rows,
 });
 const before=await snapshot();
 for(const m of migrations){const prior=installed.find(p=>p.version===m.version);if(prior)assert.equal(prior.statements.join('\n'),m.sql);else{await db.query(m.sql);await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[m.version,m.name,[m.sql]]);}}
 assert.deepEqual(await snapshot(),before,'Existing records, policies or AI activation changed');
 assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.source_registrations'::regclass")).rows[0].relrowsecurity,true);
 assert.equal((await db.query("select has_table_privilege('anon','public.source_registrations','SELECT') allowed")).rows[0].allowed,false);
 assert.equal((await db.query("select has_function_privilege('anon','public.source_registry_counts(uuid)','EXECUTE') allowed")).rows[0].allowed,false);
 await db.query('commit'); console.log('Source registry and capability migrations applied. Existing records, RLS policies and AI activation preserved.');
} catch(error){await db.query('rollback');console.error('Source registry migration failed:',error.code ?? error.name);process.exitCode=1;} finally{await db.end();}
