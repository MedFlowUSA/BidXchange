import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { localTestDatabase } from './local-test-db.mjs';
import { validateMigrations } from './staging/prepare.mjs';
import { stagingDatabase } from './staging/connection.mjs';

test('information requests enforce assignment, administrator review, concurrency, auditing and tenant isolation', async () => {
  const hosted = process.env.BIDXCHANGE_INFORMATION_TEST_STAGING === '1';
  pg.types.setTypeParser(1184, (v) => v);
  const db = hosted
    ? await stagingDatabase()
    : await localTestDatabase({ includeCompanySeed: false });
  if (hosted) {
    await db.query('begin');
    const query = db.query.bind(db);
    db.query = async (sql, args) => {
      if (sql === 'rollback') return query(sql);
      await query('savepoint info_test');
      try {
        const r = await query(sql, args);
        await query('release savepoint info_test');
        return r;
      } catch (e) {
        await query('rollback to savepoint info_test');
        await query('release savepoint info_test');
        throw e;
      }
    };
  }
  try {
    if (!hosted) {
      await db.query('create role service_role');
      for (const m of validateMigrations('supabase/migrations').filter(
        (m) => m.file > '20260919000499',
      ))
        await db.query(m.sql);
    }
    const users = Object.fromEntries(
      ['organization_admin', 'contributor', 'viewer', 'estimator', 'foreign'].map((r) => [
        r,
        randomUUID(),
      ]),
    );
    for (const id of Object.values(users))
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        id,
        `${id}@example.invalid`,
      ]);
    const orgs = [];
    for (let n = 0; n < 2; n++)
      orgs.push(
        (
          await db.query(
            "insert into public.organizations(legal_name,operating_name,slug) values('Synthetic requests','Synthetic requests',$1) returning id",
            ['requests-' + randomUUID()],
          )
        ).rows[0].id,
      );
    const [org, other] = orgs;
    for (const [role, id] of Object.entries(users))
      await db.query(
        'insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,$3)',
        [role === 'foreign' ? other : org, id, role === 'foreign' ? 'organization_admin' : role],
      );
    async function as(user, sql, args) {
      await db.query(user ? 'set role authenticated' : 'set role anon');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
      try {
        return await db.query(sql, args);
      } finally {
        await db.query(hosted ? 'set role postgres' : 'reset role');
      }
    }
    const admin = users.organization_admin,
      owner = users.contributor;
    const change = 'select public.save_information_request($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) id';
    const initial = [
      org,
      null,
      null,
      'Collect insurance dates',
      owner,
      '2099-01-01',
      'needs_information',
      'Please update the Company evidence',
      'coverage',
      'General liability insurance',
    ];
    const factsBefore = (
      await db.query('select * from public.profile_facts where organization_id=$1', [org])
    ).rows;
    for (const user of [owner, users.viewer, users.foreign, null])
      await assert.rejects(as(user, change, initial));
    for (const assignee of [users.viewer, users.foreign, null])
      await assert.rejects(
        as(
          admin,
          change,
          initial.map((v, i) => (i === 4 ? assignee : v)),
        ),
      );
    const roster = (await as(admin, 'select * from public.information_request_owners($1)', [org]))
      .rows;
    assert.equal(roster.length, 3);
    assert(!roster.some((r) => r.user_id === users.foreign || r.user_id === users.viewer));
    await db.query(
      "update public.organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",
      [org, users.estimator],
    );
    await assert.rejects(
      as(
        admin,
        change,
        initial.map((v, i) => (i === 4 ? users.estimator : v)),
      ),
    );
    assert.equal(
      (await as(admin, 'select * from public.information_request_owners($1)', [org])).rows.length,
      2,
    );
    await db.query(
      "update public.organization_memberships set status='active' where organization_id=$1 and user_id=$2",
      [org, users.estimator],
    );
    for (const user of [owner, users.viewer, users.foreign, null])
      await assert.rejects(as(user, 'select * from public.information_request_owners($1)', [org]));
    const id = (await as(admin, change, initial)).rows[0].id;
    const row = async () =>
      (await db.query('select * from public.onboarding_items where id=$1', [id])).rows[0];
    let r = await row();
    assert.equal(r.requested_by, admin);
    await assert.rejects(as(admin, change, initial));
    await assert.rejects(
      as(
        admin,
        change,
        initial.map((v, i) => (i === 3 ? 'Different label' : v)),
      ),
    );
    for (const sql of [
      "update public.onboarding_items set status='complete' where id=$1",
      'delete from public.onboarding_items where id=$1',
    ])
      await assert.rejects(as(admin, sql, [id]));
    await assert.rejects(
      as(admin, "insert into public.onboarding_items(organization_id,label) values($1,'Bypass')", [
        org,
      ]),
    );
    const args = (status = 'pending_review', note = 'Evidence dates entered') => [
      org,
      id,
      r.updated_at,
      r.label,
      owner,
      '2099-01-01',
      status,
      note,
      'coverage',
      'General liability insurance',
    ];
    await assert.rejects(as(users.estimator, change, args()));
    await assert.rejects(as(owner, change, args('complete')));
    await assert.rejects(as(owner, change, args('pending_review', '')));
    await assert.rejects(
      as(
        owner,
        change,
        args().map((v, i) => (i === 4 ? admin : v)),
      ),
    );
    const old = args();
    await as(owner, change, args());
    r = await row();
    assert.equal(r.status, 'pending_review');
    assert.equal(r.last_updated_by, owner);
    await assert.rejects(as(owner, change, old));
    await as(admin, change, args('complete', 'Reviewed saved information'));
    r = await row();
    assert.equal(r.completed_by, admin);
    assert(r.completed_at);
    await assert.rejects(as(owner, change, args('needs_information')));
    await as(admin, change, args('needs_information', 'Please clarify source'));
    r = await row();
    assert.equal(r.completed_at, null);
    assert.equal(r.completed_by, null);
    assert.equal(
      (await as(users.foreign, 'select * from public.onboarding_items where id=$1', [id])).rows
        .length,
      0,
    );
    assert.equal(
      (await as(users.viewer, 'select * from public.onboarding_items where id=$1', [id])).rows
        .length,
      1,
    );
    await assert.rejects(as(users.foreign, change, args()));
    assert.deepEqual(
      (await db.query('select * from public.profile_facts where organization_id=$1', [org])).rows,
      factsBefore,
    );
    const audit = (
      await db.query(
        "select * from public.audit_events where organization_id=$1 and entity_table='onboarding_items'",
        [org],
      )
    ).rows;
    assert(audit.length >= 4);
    assert(audit.some((a) => a.actor_user_id === owner));
    assert(
      audit.some(
        (a) =>
          a.previous_record?.status === 'pending_review' &&
          a.next_record?.status === 'complete' &&
          a.actor_user_id === admin,
      ),
    );
  } finally {
    if (hosted) await db.query('rollback');
    await db.end();
  }
});
