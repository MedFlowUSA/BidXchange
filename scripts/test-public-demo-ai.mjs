import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localTestDatabase } from './local-test-db.mjs';
test('public demo quotas are private, independently capped, idempotent and fail closed', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  try {
    await db.query('create role service_role');
    await db.query(readFileSync('supabase/migrations/20260920001400_public_demo_ai.sql', 'utf8'));
    const sql = 'select public.reserve_demo_ai($1,$2,$3) as result';
    async function reserve(v = 'a'.repeat(64), n = 'b'.repeat(64), id = randomUUID()) {
      await db.query('set role service_role');
      try {
        return (await db.query(sql, [id, v, n])).rows[0].result;
      } finally {
        await db.query('reset role');
      }
    }
    assert.equal(await reserve(), 'disabled');
    for (const role of ['anon', 'authenticated']) {
      await db.query('set role ' + role);
      await assert.rejects(db.query('select * from public.demo_ai_usage'), /permission denied/);
      await assert.rejects(
        db.query(sql, [randomUUID(), 'a'.repeat(64), 'b'.repeat(64)]),
        /permission denied/,
      );
      await db.query('reset role');
    }
    await db.query('update public.demo_ai_settings set enabled=true');
    const id = randomUUID();
    assert.equal(await reserve(undefined, undefined, id), 'reserved');
    assert.equal(await reserve(undefined, undefined, id), 'duplicate');
    assert.equal(await reserve(), 'wait');
    for (let i = 1; i < 5; i++) {
      await db.query("update public.demo_ai_usage set created_at=now()-interval '2 minutes'");
      assert.equal(await reserve(), 'reserved');
    }
    assert.equal(await reserve(), 'visitor_limit');
    await db.query('delete from public.demo_ai_usage');
    for (let i = 0; i < 10; i++) {
      await db.query("update public.demo_ai_usage set created_at=now()-interval '2 minutes'");
      assert.equal(await reserve(i.toString(16).padStart(64, '0')), 'reserved');
    }
    assert.equal(await reserve('f'.repeat(64)), 'network_limit');
    await db.query('delete from public.demo_ai_usage');
    for (let i = 0; i < 100; i++) {
      const hash = i.toString(16).padStart(64, '0');
      assert.equal(await reserve(hash, hash), 'reserved');
    }
    assert.equal(await reserve(), 'daily_limit');
    await db.query('set role service_role');
    await assert.rejects(
      db.query('update public.demo_ai_settings set enabled=false'),
      /permission denied/,
    );
    await db.query('reset role');
    assert.equal((await db.query('select count(*)::int n from public.organizations')).rows[0].n, 0);
  } finally {
    await db.end();
  }
});
