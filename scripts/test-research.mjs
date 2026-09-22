import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localTestDatabase } from './local-test-db.mjs';
test('saved research and audit metadata remain private to active members and append-only', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  const a = '80000000-0000-4000-8000-000000000001',
    b = '80000000-0000-4000-8000-000000000002';
  const as = async (user, role = 'authenticated') => {
    await db.query('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.query(`set role ${role}`);
  };
  try {
    await db.query(
      readFileSync('supabase/migrations/20260921001900_opportunity_research.sql', 'utf8'),
    );
    await db.query('insert into auth.users(id) values($1),($2)', [a, b]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Synthetic','Synthetic','research-test') returning id",
      )
    ).rows[0].id;
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin'),($1,$3,'viewer')",
      [org, a, b],
    );
    await as(a);
    const search = (
      await db.query(
        "insert into public.research_saved_searches(organization_id,name,prompt,plan) values($1,'Test','Find work','{}') returning id",
        [org],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.research_run_audit(id,organization_id,filter_digest,sources,reviewed,returned,partial,result_ids) values($1,$2,$3,'{workspace}',0,0,false,'{}')",
      [a, org, 'a'.repeat(64)],
    );
    await assert.rejects(db.query('update public.research_run_audit set returned=1'));
    await assert.rejects(db.query('delete from public.research_run_audit'));
    await as(b);
    assert.equal((await db.query('select * from public.research_saved_searches')).rows.length, 0);
    assert.equal((await db.query('select * from public.research_run_audit')).rows.length, 0);
    assert.equal(
      (
        await db.query('delete from public.research_saved_searches where id=$1 returning id', [
          search,
        ])
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into public.research_saved_searches(organization_id,user_id,name,prompt,plan) values($1,$2,'Forged','Find','{}')",
        [org, a],
      ),
    );
    await as(a, 'anon');
    await assert.rejects(db.query('select * from public.research_saved_searches'));
    await as(a);
    await db.query('delete from public.research_saved_searches where id=$1', [search]);
    await db.query('reset role');
    await db.query(
      "update public.organization_memberships set role='organization_admin' where user_id=$1",
      [b],
    );
    await db.query(
      "update public.organization_memberships set status='suspended' where user_id=$1",
      [a],
    );
    await as(a);
    assert.equal((await db.query('select * from public.research_run_audit')).rows.length, 0);
  } finally {
    await db.end();
  }
});
