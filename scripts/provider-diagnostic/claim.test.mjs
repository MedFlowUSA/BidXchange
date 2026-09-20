import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localTestDatabase } from '../local-test-db.mjs';
test('reviewed SQL claim is disabled by default, operator-scoped, expiring and irrevocably consumed', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  const operator = '11111111-1111-4111-8111-111111111111',
    other = '22222222-2222-4222-8222-222222222222',
    run = '33333333-3333-4333-8333-333333333333';
  const asUser = async (id) => {
    await db.query('set role postgres');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.query('set role authenticated');
  };
  const claim = async () =>
    (await db.query('select public.claim_provider_diagnostic($1) ok', [run])).rows[0].ok;
  try {
    await db.query(readFileSync('scripts/provider-diagnostic/staging-claim.sql', 'utf8'));
    await db.query('insert into auth.users(id) values($1),($2)', [operator, other]);
    await db.query(
      "insert into private.provider_diagnostic_runs(id,operator_user_id,expires_at) values($1,$2,now()+interval '15 minutes')",
      [run, operator],
    );
    await asUser(operator);
    assert.equal(await claim(), false);
    await assert.rejects(db.query('select * from private.provider_diagnostic_runs'), {
      code: '42501',
    });
    await db.query('set role postgres');
    await db.query('update private.provider_diagnostic_runs set enabled=true');
    await asUser(other);
    assert.equal(await claim(), false);
    await asUser(operator);
    assert.equal(await claim(), true);
    assert.equal(await claim(), false);
    await db.query('set role postgres');
    await db.query('update private.provider_diagnostic_runs set enabled=true');
    await asUser(operator);
    assert.equal(await claim(), false);
    await db.query('set role postgres');
    await db.query(
      "insert into private.provider_diagnostic_runs(id,operator_user_id,enabled,expires_at) values($1,$2,true,now()-interval '1 second')",
      [other, operator],
    );
    await asUser(operator);
    assert.equal(
      (await db.query('select public.claim_provider_diagnostic($1) ok', [other])).rows[0].ok,
      false,
    );
    await db.query('set role anon');
    await assert.rejects(db.query('select public.claim_provider_diagnostic($1)', [run]), {
      code: '42501',
    });
  } finally {
    await db.end();
  }
});
