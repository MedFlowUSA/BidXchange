import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localTestDatabase } from './local-test-db.mjs';

test('intake is service-only, quotas persist, operators are explicitly enrolled and edits use versions', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  const owner = '60000000-0000-4000-8000-000000000001';
  const stranger = '60000000-0000-4000-8000-000000000002';
  try {
    await db.query('create role service_role; grant usage on schema public to service_role;');
    await db.query(readFileSync('supabase/migrations/20260919000600_demo_intake.sql', 'utf8'));
    await db.query('insert into auth.users(id) values($1),($2)', [owner, stranger]);
    async function as(role, user, sql, args) {
      await db.query(`set role ${role}`);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
      try {
        return await db.query(sql, args);
      } finally {
        await db.query('reset role');
      }
    }
    const submit = 'select public.submit_demo_request($1,$2,$3,$4,$5,$6) ok';
    const input = [
      'Synthetic Prospect',
      'prospect@example.invalid',
      'Synthetic Company',
      'Test request',
      'a'.repeat(64),
      'b'.repeat(64),
    ];
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(as(role, stranger, submit, input), /permission denied/);
      await assert.rejects(
        as(
          role,
          stranger,
          "insert into public.demo_requests(full_name,email,company) values ('Other','x@example.invalid','Other')",
        ),
        /permission denied/,
      );
      await assert.rejects(
        as(role, stranger, 'insert into private.demo_operators(user_id) values($1)', [stranger]),
        /permission denied/,
      );
    }
    assert.equal((await as('service_role', null, submit, input)).rows[0].ok, true);
    const row = (await db.query('select * from public.demo_requests')).rows[0];
    assert.equal(row.owner_email, 'mrodriguez@oaisinc.com');
    assert.equal(row.consent_version, 'demo-contact-v1');
    assert.equal(
      (await as('authenticated', stranger, 'select * from public.demo_requests')).rows.length,
      0,
    );
    assert.equal(
      (
        await as(
          'authenticated',
          stranger,
          "select public.review_demo_request($1,1,'contacted') ok",
          [row.id],
        )
      ).rows[0].ok,
      false,
    );
    assert.equal(
      (await as('authenticated', owner, 'select public.is_demo_operator() ok')).rows[0].ok,
      false,
    );
    await db.query('insert into private.demo_operators(user_id) values($1)', [owner]);
    assert.equal(
      (await as('authenticated', owner, 'select * from public.demo_requests')).rows.length,
      1,
    );
    await assert.rejects(
      as('authenticated', owner, "update public.demo_requests set status='contacted'"),
      /permission denied/,
    );
    await assert.rejects(
      as('authenticated', owner, 'select * from private.demo_intake_limits'),
      /permission denied/,
    );
    assert.equal(
      (
        await as('authenticated', owner, "select public.review_demo_request($1,1,'contacted') ok", [
          row.id,
        ])
      ).rows[0].ok,
      true,
    );
    assert.equal(
      (
        await as('authenticated', owner, "select public.review_demo_request($1,1,'closed') ok", [
          row.id,
        ])
      ).rows[0].ok,
      false,
    );
    assert.equal((await db.query('select version from public.demo_requests')).rows[0].version, 2);
    assert.equal((await as('service_role', null, submit, input)).rows[0].ok, true);
    assert.equal((await as('service_role', null, submit, input)).rows[0].ok, true);
    assert.equal((await as('service_role', null, submit, input)).rows[0].ok, false);
    assert.equal(
      (
        await db.query('select attempts from private.demo_intake_limits where bucket=$1', [
          'email:' + input[5],
        ])
      ).rows[0].attempts,
      4,
    );
    assert.equal((await db.query('select count(*)::int n from public.demo_requests')).rows[0].n, 3);
    assert.equal(
      (await as('service_role', null, submit, [...input.slice(0, 4), 'untrusted', input[5]]))
        .rows[0].ok,
      false,
    );
    assert.equal(
      (await as('authenticated', stranger, 'select public.erase_demo_request($1,2) ok', [row.id]))
        .rows[0].ok,
      false,
    );
    assert.equal(
      (await as('authenticated', owner, 'select public.erase_demo_request($1,1) ok', [row.id]))
        .rows[0].ok,
      false,
    );
    assert.equal(
      (await as('authenticated', owner, 'select public.erase_demo_request($1,2) ok', [row.id]))
        .rows[0].ok,
      true,
    );
    assert.equal(
      (await db.query('select * from public.demo_requests where id=$1', [row.id])).rows.length,
      0,
    );
    assert.deepEqual(
      (
        await db.query(
          'select action from private.demo_request_events where request_id=$1 order by created_at,id',
          [row.id],
        )
      ).rows.map((r) => r.action),
      ['created', 'status:contacted', 'erased'],
    );
    await db.query('delete from private.demo_operators where user_id=$1', [owner]);
    assert.equal(
      (await as('authenticated', owner, 'select * from public.demo_requests')).rows.length,
      0,
    );
    // Old counters expire; the global cap is enforced before allocating new buckets.
    await db.query("update private.demo_intake_limits set window_start=now()-interval '25 hours'");
    assert.equal((await as('service_role', null, submit, input)).rows[0].ok, true);
    await db.query("update private.demo_intake_limits set attempts=100 where bucket='global'");
    assert.equal(
      (
        await as('service_role', null, submit, [
          ...input.slice(0, 4),
          'c'.repeat(64),
          'd'.repeat(64),
        ])
      ).rows[0].ok,
      false,
    );
    assert.equal(
      (
        await db.query('select count(*)::int n from private.demo_intake_limits where bucket=$1', [
          'ip:' + 'c'.repeat(64),
        ])
      ).rows[0].n,
      0,
    );
    assert.equal((await db.query('select count(*)::int n from public.organizations')).rows[0].n, 0);
  } finally {
    await db.end();
  }
});
