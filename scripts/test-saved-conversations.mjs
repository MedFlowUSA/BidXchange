import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localTestDatabase } from './local-test-db.mjs';
test('saved conversation RLS isolates users, roles, organizations and bid ownership', async () => {
  const hosted = process.env.BIDX_SAVED_TEST_TARGET;
  assert(!hosted || ['staging', 'production'].includes(hosted));
  const db =
    hosted === 'staging'
      ? await (await import('./staging/connection.mjs')).stagingDatabase()
      : hosted === 'production'
        ? await (await import('./db.mjs')).connectDatabase()
        : await localTestDatabase({ includeCompanySeed: false });
  try {
    await db.query('begin');
    if (!hosted)
      await db.query(
        readFileSync('supabase/migrations/20260926003400_private_bid_conversations.sql', 'utf8'),
      );
    const org = randomUUID(),
      other = randomUUID(),
      user = randomUUID(),
      peer = randomUUID(),
      bid = randomUUID(),
      foreign = randomUUID();
    await db.query(`insert into auth.users(id) values($1),($2)`, [user, peer]);
    await db.query(
      `insert into public.organizations(id,legal_name,operating_name,slug) values($1::uuid,'Fictional','Fictional',$1::text),($2::uuid,'Other','Other',$2::text)`,
      [org, other],
    );
    await db.query(
      `insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'viewer'),($1,$3,'viewer')`,
      [org, user, peer],
    );
    await db.query(
      `insert into public.opportunities(id,organization_id,title,buyer) values($1,$2,'Fictional','Fictional'),($3,$4,'Other','Other')`,
      [bid, org, foreign, other],
    );
    await db.query(
      `insert into public.pursuits(id,organization_id,opportunity_id,title) values($1,$2,$1,'Fictional'),($3,$4,$3,'Other')`,
      [bid, org, foreign, other],
    );
    async function as(id) {
      await db.query('set role postgres');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.query('set role authenticated');
    }
    async function denied(sql, args) {
      await db.query('savepoint denied_attempt');
      await assert.rejects(db.query(sql, args));
      await db.query('rollback to savepoint denied_attempt');
    }
    const insert = `insert into public.ai_bid_conversations(organization_id,pursuit_id,user_id,checkpoint_id,role,encrypted_payload,expires_at) values($1,$2,$3,$4,'viewer',repeat('x',50),now()+interval '30 days')`;
    await as(user);
    await db.query(insert, [org, bid, user, randomUUID()]);
    assert.equal((await db.query('select * from public.ai_bid_conversations')).rows.length, 1);
    await denied(insert, [org, foreign, user, randomUUID()]);
    await denied(insert, [other, foreign, user, randomUUID()]);
    await denied(insert, [org, bid, peer, randomUUID()]);
    await as(peer);
    assert.equal((await db.query('select * from public.ai_bid_conversations')).rows.length, 0);
    await db.query('delete from public.ai_bid_conversations');
    await as(user);
    assert.equal((await db.query('select * from public.ai_bid_conversations')).rows.length, 1);
    await db.query('set role postgres');
    await db.query(
      "update public.organization_memberships set role='contributor' where user_id=$1",
      [user],
    );
    await as(user);
    assert.equal((await db.query('select * from public.ai_bid_conversations')).rows.length, 0);
    await db.query('set role postgres');
    await db.query("update public.organization_memberships set role='viewer' where user_id=$1", [
      user,
    ]);
    await as(user);
    await db.query('delete from public.ai_bid_conversations');
    assert.equal((await db.query('select * from public.ai_bid_conversations')).rows.length, 0);
    await db.query('set role postgres');
    await db.query('set role anon');
    await denied('select * from public.ai_bid_conversations');
  } finally {
    await db.query('rollback');
    await db.end();
  }
});
