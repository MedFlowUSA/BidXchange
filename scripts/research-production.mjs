import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {connectDatabase} from './db.mjs';
assert.equal(process.argv[2],'apply-approved');
assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL);
const ref='bcrxejydosltquspsutw';
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),ref);
const version='20260921001900',name='opportunity_research';
const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
assert.equal(createHash('sha256').update(sql).digest('hex'),'0b9457f2c38eef5baedb3e58494548b651ac0bba007d19fc8ecd80412349d86d');
const db=await connectDatabase();
try {
 assert(db.connectionParameters.host===`db.${ref}.supabase.co`||db.connectionParameters.user.endsWith(`.${ref}`));
 await db.query('begin');await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
 const snapshot=async()=>({
  facts:(await db.query("select count(*)::int n,md5(coalesce(string_agg(to_jsonb(f)::text,'' order by id),'')) digest from public.profile_facts f")).rows,
  opportunities:(await db.query("select count(*)::int n,md5(coalesce(string_agg(to_jsonb(o)::text,'' order by id),'')) digest from public.opportunities o")).rows,
  ai:(await db.query('select organization_id,enabled from public.ai_organization_settings order by organization_id')).rows,
  source:(await db.query("select to_regclass('public.procurement_sources')::text source_table")).rows,
 });
 const before=await snapshot();
 const previous=(await db.query('select statements from supabase_migrations.schema_migrations where version=$1',[version])).rows[0];
 if(previous)assert.equal(previous.statements.join('\n'),sql);else {
  await db.query(sql);
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,name,[sql]]);
 }
 assert.deepEqual(await snapshot(),before);
 for(const table of ['research_saved_searches','research_run_audit']) {
  assert.equal((await db.query('select relrowsecurity from pg_class where oid=$1::regclass',[`public.${table}`])).rows[0].relrowsecurity,true);
  assert.equal((await db.query("select has_table_privilege('anon',$1,'SELECT') allowed",[`public.${table}`])).rows[0].allowed,false);
 }
 await db.query('commit');console.log('Research persistence migration installed; existing records, AI settings and source activation unchanged.');
}catch(error){await db.query('rollback');console.error('Research migration failed:',error.code??error.name);process.exitCode=1;}finally{await db.end();}
