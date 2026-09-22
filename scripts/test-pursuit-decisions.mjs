import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localTestDatabase } from './local-test-db.mjs';
import { validateMigrations } from './staging/prepare.mjs';
test('human decisions enforce authority, attribution, history and stale context without enabling submission', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  const admin = '80000000-0000-4000-8000-000000000001',
    exec = '80000000-0000-4000-8000-000000000002',
    viewer = '80000000-0000-4000-8000-000000000003',
    foreign = '80000000-0000-4000-8000-000000000004';
  try {
    await db.query('create role service_role');
    for (const m of validateMigrations('supabase/migrations').filter(
      (m) => m.file > '20260919000499',
    ))
      await db.query(m.sql);
    await db.query('insert into auth.users(id) values($1),($2),($3),($4)', [
      admin,
      exec,
      viewer,
      foreign,
    ]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Synthetic','Synthetic','decision-test') returning id",
      )
    ).rows[0].id;
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin'),($1,$3,'executive_approver'),($1,$4,'viewer')",
      [org, admin, exec, viewer],
    );
    const opp = (
      await db.query(
        "insert into public.opportunities(organization_id,title) values($1,'Synthetic') returning id",
        [org],
      )
    ).rows[0].id;
    const pursuit = (
      await db.query(
        "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Synthetic') returning id",
        [org, opp],
      )
    ).rows[0].id;
    async function as(user, sql, args) {
      await db.query('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      try {
        return await db.query(sql, args);
      } finally {
        await db.query('reset role');
      }
    }
    const context = async (user) =>
      (await as(user, 'select public.pursuit_decision_context($1,$2) token', [org, pursuit]))
        .rows[0].token;
    const version = async () =>
      (await db.query('select updated_at from public.pursuits where id=$1', [pursuit])).rows[0]
        .updated_at;
    const sql = 'select public.record_pursuit_decision($1,$2,$3,$4,$5,$6,$7)';
    const args = async (outcome = 'bid') => [
      org,
      pursuit,
      await version(),
      await context(admin),
      outcome,
      'Human rationale',
      'Subject to final pricing approval',
    ];
    await assert.rejects(
      as(foreign, 'select public.pursuit_decision_context($1,$2)', [org, pursuit]),
    );
    await assert.rejects(as(viewer, sql, await args()));
    await assert.rejects(as(foreign, sql, await args()));
    await assert.rejects(
      as(admin, "update public.pursuits set decision='bid' where id=$1", [pursuit]),
      /permission denied/,
    );
    await assert.rejects(
      as(
        admin,
        "insert into public.pursuit_decision_history(organization_id,pursuit_id,decision,reason,conditions,context_token,decided_by) values($1,$2,'bid','forged','','x',$3)",
        [org, pursuit, viewer],
      ),
      /permission denied/,
    );
    await db.query(
      "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation) values($1,$2,'Synthetic scope','Section 1')",
      [org, pursuit],
    );
    await as(exec, 'select public.sign_off_requirements_register($1,$2,$3,$4)', [
      org,
      pursuit,
      await context(exec),
      'Synthetic review',
    ]);
    const old = await args();
    await as(exec, sql, old);
    const saved = (await db.query('select * from public.pursuits where id=$1', [pursuit])).rows[0];
    assert.equal(saved.decision, 'bid');
    assert.equal(saved.decided_by, exec);
    assert(saved.decided_at);
    await assert.rejects(as(admin, sql, old), /Pursuit changed/);
    const history = (await as(viewer, 'select * from public.pursuit_decision_history')).rows;
    assert.equal(history.length, 1);
    assert.equal(history[0].decided_by, exec);
    assert.equal(
      (await as(foreign, 'select * from public.pursuit_decision_history')).rows.length,
      0,
    );
    await assert.rejects(
      as(admin, 'delete from public.pursuit_decision_history'),
      /permission denied/,
    );
    await assert.rejects(
      as(admin, "update public.pursuit_decision_history set reason='overwrite'"),
      /permission denied/,
    );
    const stale = await args();
    await db.query(
      "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation) values($1,$2,'New amendment','Section 3')",
      [org, pursuit],
    );
    await assert.rejects(as(admin, sql, stale), /context changed/);
    await as(admin, 'select public.sign_off_requirements_register($1,$2,$3,$4)', [
      org,
      pursuit,
      await context(admin),
      'Synthetic amendment review',
    ]);
    await as(admin, sql, await args('no_bid'));
    await as(admin, sql, await args('pending'));
    assert.equal(
      (await db.query('select count(*)::int n from public.pursuit_decision_history')).rows[0].n,
      3,
    );
    await db.query(
      "update public.organization_memberships set role='capture_manager' where organization_id=$1 and user_id=$2",
      [org, exec],
    );
    await assert.rejects(as(exec, sql, await args()));
    await assert.rejects(
      as(
        admin,
        "insert into public.submission_records(organization_id,pursuit_id,status) values($1,$2,'submitted')",
        [org, pursuit],
      ),
    );
    await db.query("update public.organizations set status='suspended' where id=$1", [org]);
    await assert.rejects(
      as(admin, sql, [org, pursuit, await version(), 'invalid', 'bid', 'Reason', '']),
    );
  } finally {
    await db.end();
  }
});
