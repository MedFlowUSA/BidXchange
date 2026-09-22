import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { localTestDatabase } from './local-test-db.mjs';
import { stagingDatabase } from './staging/connection.mjs';

test('scheduled evidence checks are isolated, repeatable, source-authorized and preserve human decisions', async () => {
  const hosted = process.env.BIDXCHANGE_MONITOR_TEST_STAGING === '1';
  const db = hosted
    ? await stagingDatabase()
    : await localTestDatabase({ includeCompanySeed: false });
  if (hosted) {
    await db.query('begin');
    const query = db.query.bind(db);
    db.query = async (sql, args) => {
      if (sql === 'rollback') return query(sql, args);
      await query('savepoint monitor_test');
      try {
        const r = await query(sql, args);
        await query('release savepoint monitor_test');
        return r;
      } catch (e) {
        await query('rollback to savepoint monitor_test');
        await query('release savepoint monitor_test');
        throw e;
      }
    };
  } else
    for (const file of [
      '20260919000500_ai_readonly.sql',
      '20260919000700_evidence_use_reviews.sql',
      '20260919000800_evidence_review_grants.sql',
      '20260919000900_evidence_review_conflict.sql',
      '20260920001000_pursuit_decisions.sql',
      '20260920001100_requirement_resolutions.sql',
      '20260921001600_structured_company_profiles.sql',
      '20260921001800_company_source_capabilities.sql',
      '20260921002000_california_passport_catalog.sql',
      '20260921002100_requirements_register_signoff.sql',
      '20260921002200_contractor_tasks_amendments.sql',
      '20260921002300_evidence_freshness_radar.sql',
      '20260921002400_requirement_not_applicable.sql',
      '20260921002600_monotonic_record_versions.sql',
      '20260922002800_scheduled_evidence_monitor.sql',
    ])
      await db.query(readFileSync('supabase/migrations/' + file, 'utf8'));
  const admin = randomUUID(),
    viewer = randomUUID(),
    foreign = randomUUID();
  const as = async (user, sql, args) => {
    await db.query('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    try {
      return await db.query(sql, args);
    } finally {
      await db.query(hosted ? 'set role postgres' : 'reset role');
      await db.query("select set_config('request.jwt.claim.sub','',false)");
    }
  };
  try {
    await db.query('insert into auth.users(id) values($1),($2),($3)', [admin, viewer, foreign]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Synthetic monitor','Synthetic monitor',$1) returning id",
        ['monitor-' + randomUUID()],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin'),($1,$3,'viewer')",
      [org, admin, viewer],
    );
    const profile = (
      await db.query(
        'insert into public.company_profiles(organization_id) values($1) returning id',
        [org],
      )
    ).rows[0].id;
    const fact = async (label, days, type = 'insurance', sensitivity = 'restricted') =>
      (
        await as(
          admin,
          "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value,source_reference,sensitivity,expiration_date,owner_user_id) values($1,$2,$3,$4,'Synthetic only','Fictional source',$5,current_date+$6::int,$7) returning id",
          [org, profile, type, label, sensitivity, days, viewer],
        )
      ).rows[0].id;
    const expired = await fact('Restricted policy', -1),
      thirty = await fact('Visible license', 30, 'license', 'workspace'),
      sixty = await fact('60 day policy', 60),
      ninety = await fact('90 day policy', 90),
      future = await fact('Future policy', 91);
    const stale = (
      await as(
        admin,
        "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value,source_reference,sensitivity,structured_kind,structured_fields) values($1,$2,'registration','Stale registry','Synthetic only','Fictional registry','workspace','registration',jsonb_build_object('program','DIR PWCR','last_checked',to_char(current_date-91,'YYYY-MM-DD'))) returning id",
        [org, profile],
      )
    ).rows[0].id;
    const opp = (
      await db.query(
        "insert into public.opportunities(organization_id,title) values($1,'Synthetic opportunity') returning id",
        [org],
      )
    ).rows[0].id;
    const pursuit = (
      await db.query(
        "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Synthetic pursuit') returning id",
        [org, opp],
      )
    ).rows[0].id;
    const requirement = async (title) =>
      (
        await db.query(
          "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation,status) values($1,$2,$3,'Fictional section','ready') returning id",
          [org, pursuit, title],
        )
      ).rows[0].id;
    const req = await requirement('Policy review'),
      dismissed = await requirement('Dismissed link');
    const link = (r, applicability) =>
      as(
        admin,
        "insert into public.evidence_use_reviews(organization_id,requirement_id,fact_id,fact_version,requirement_version,applicability,proposal_use,reason) select $1,r.id,f.id,f.updated_at,r.updated_at,$4,'not_approved','Synthetic review' from public.profile_facts f,public.pursuit_requirements r where f.id=$2 and r.id=$3",
        [org, expired, r, applicability],
      );
    await link(req, 'unknown');
    await link(dismissed, 'applicable');
    await link(dismissed, 'not_applicable');
    const ctx = async () =>
      (await as(admin, 'select public.pursuit_decision_context($1,$2) token', [org, pursuit]))
        .rows[0].token;
    await as(admin, 'select public.sign_off_requirements_register($1,$2,$3,$4)', [
      org,
      pursuit,
      await ctx(),
      'Synthetic human review',
    ]);
    await as(
      admin,
      "select public.record_pursuit_decision($1,$2,(select updated_at from public.pursuits where id=$2),public.pursuit_decision_context($1,$2),'no_bid','Synthetic decision','Synthetic conditions')",
      [org, pursuit],
    );
    const history = (
      await db.query(
        'select to_jsonb(h) data from public.pursuit_decision_history h where organization_id=$1',
        [org],
      )
    ).rows;
    const oldContext = await ctx();
    await assert.rejects(
      as(admin, 'select private.monitor_organization_evidence($1)', [org]),
      /permission/,
    );
    await assert.rejects(as(viewer, 'select private.run_evidence_monitor(25)'), /permission/);
    assert.equal(
      (await db.query('select private.monitor_organization_evidence($1) n', [org])).rows[0].n,
      1,
    );
    assert.notEqual(await ctx(), oldContext);
    assert.equal(
      (await db.query('select status from public.pursuit_requirements where id=$1', [req])).rows[0]
        .status,
      'needs_review',
    );
    assert.equal(
      (await db.query('select status from public.pursuit_requirements where id=$1', [dismissed]))
        .rows[0].status,
      'ready',
      'latest dismissed link does not reopen',
    );
    const tasks = (
      await db.query('select * from public.pursuit_tasks where organization_id=$1', [org])
    ).rows;
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].assigned_user_id, admin);
    assert.equal(tasks[0].created_by, null);
    assert(
      !JSON.stringify(tasks).includes('Restricted policy'),
      'generic task cannot leak restricted labels',
    );
    assert.equal(
      (await db.query('select decision from public.pursuits where id=$1', [pursuit])).rows[0]
        .decision,
      'no_bid',
    );
    assert.deepEqual(
      (
        await db.query(
          'select to_jsonb(h) data from public.pursuit_decision_history h where organization_id=$1',
          [org],
        )
      ).rows,
      history,
    );
    await assert.rejects(
      as(
        admin,
        "select public.record_pursuit_decision($1,$2,(select updated_at from public.pursuits where id=$2),public.pursuit_decision_context($1,$2),'no_bid','Still pass','Review')",
        [org, pursuit],
      ),
      /sign-off/,
    );
    const reminders = async () =>
      (
        await db.query(
          'select *,updated_at::text version from public.evidence_reminders where organization_id=$1 order by fact_id',
          [org],
        )
      ).rows;
    const initial = await reminders();
    assert.equal(initial.length, 5);
    assert.equal(initial.find((r) => r.fact_id === expired).assigned_user_id, admin);
    assert.equal(initial.find((r) => r.fact_id === thirty).assigned_user_id, viewer);
    for (const [id, kind] of [
      [expired, 'expired'],
      [stale, 'stale'],
      [thirty, '30'],
      [sixty, '60'],
      [ninety, '90'],
    ])
      assert.equal(initial.find((r) => r.fact_id === id).kind, kind);
    assert(!initial.some((r) => r.fact_id === future));
    assert.equal(
      (await as(viewer, 'select * from public.evidence_reminders where organization_id=$1', [org]))
        .rows.length,
      2,
    );
    assert.equal(
      (await as(foreign, 'select * from public.evidence_reminders where organization_id=$1', [org]))
        .rows.length,
      0,
    );
    const restricted = initial.find((r) => r.fact_id === expired),
      own = initial.find((r) => r.fact_id === thirty);
    await assert.rejects(
      as(viewer, 'select public.acknowledge_evidence_reminder($1,$2,$3)', [
        org,
        restricted.id,
        restricted.version,
      ]),
      /Source access/,
    );
    await assert.rejects(as(foreign, 'select public.evidence_monitor_status($1)', [org]), /access/);
    await as(viewer, 'select public.acknowledge_evidence_reminder($1,$2,$3)', [
      org,
      own.id,
      own.version,
    ]);
    const acknowledged = (await reminders()).find((r) => r.id === own.id);
    assert.equal(acknowledged.acknowledged_by, viewer);
    await assert.rejects(
      as(viewer, 'update public.evidence_reminders set resolved_at=now() where id=$1', [own.id]),
      /permission/,
    );
    const before = (await reminders()).map((r) => ({ id: r.id, version: r.version }));
    assert.equal(
      (await db.query('select private.monitor_organization_evidence($1) n', [org])).rows[0].n,
      0,
    );
    assert.deepEqual(
      (await reminders()).map((r) => ({ id: r.id, version: r.version })),
      before,
      'unchanged daily runs do not create reminders or reset acknowledgement',
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from public.pursuit_tasks where organization_id=$1',
          [org],
        )
      ).rows[0].n,
      1,
    );
    await as(admin, 'update public.profile_facts set expiration_date=current_date-1 where id=$1', [
      thirty,
    ]);
    await db.query('select private.monitor_organization_evidence($1)', [org]);
    const escalated = (await reminders()).find((r) => r.id === own.id);
    assert.equal(escalated.kind, 'expired');
    assert.equal(escalated.acknowledged_at, null);
    await assert.rejects(
      as(viewer, 'select public.acknowledge_evidence_reminder($1,$2,$3)', [
        org,
        own.id,
        own.version,
      ]),
      /changed/,
    );
    await as(
      admin,
      'update public.profile_facts set expiration_date=current_date+365 where id=$1',
      [expired],
    );
    await db.query('select private.monitor_organization_evidence($1)', [org]);
    assert((await reminders()).find((r) => r.fact_id === expired).resolved_at);
    assert.equal(
      (await db.query('select status from public.pursuit_requirements where id=$1', [req])).rows[0]
        .status,
      'needs_review',
      'renewal does not approve',
    );
    assert.equal(
      (await db.query('select status from public.pursuit_tasks where id=$1', [tasks[0].id])).rows[0]
        .status,
      'todo',
      'renewal does not complete task',
    );
    await as(admin, 'update public.profile_facts set expiration_date=current_date-2 where id=$1', [
      expired,
    ]);
    await db.query('select private.monitor_organization_evidence($1)', [org]);
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from public.pursuit_tasks where organization_id=$1',
          [org],
        )
      ).rows[0].n,
      2,
      'new expiry after renewal is a new review event',
    );
    await db.query("update public.pursuits set status='closed' where id=$1", [pursuit]);
    await as(admin, 'update public.profile_facts set expiration_date=current_date-3 where id=$1', [
      expired,
    ]);
    assert.equal(
      (await db.query('select private.monitor_organization_evidence($1) n', [org])).rows[0].n,
      0,
      'closed pursuit skipped',
    );
    // Keep hosted rollback runs confined: temporarily defer all other orgs in scheduler state.
    await db.query(
      'insert into private.evidence_monitor_state(organization_id,last_success_at) select id,now() from public.organizations where id<>$1 on conflict(organization_id) do update set last_success_at=now()',
      [org],
    );
    assert.equal((await db.query('select private.run_evidence_monitor(1) n')).rows[0].n, 1);
    assert.equal(
      (await db.query('select private.run_evidence_monitor(1) n')).rows[0].n,
      0,
      'one successful pass per UTC date',
    );
    assert(
      (await as(viewer, 'select * from public.evidence_monitor_status($1)', [org])).rows[0]
        .last_success_at,
    );
    const failingFact = await fact('Retry test source', -1);
    await db.query(
      `create function private.synthetic_monitor_failure() returns trigger language plpgsql as $$begin if new.fact_id='${failingFact}'::uuid then raise exception 'synthetic retry'; end if; return new; end$$; create trigger synthetic_monitor_failure before insert on public.evidence_reminders for each row execute function private.synthetic_monitor_failure();`,
    );
    await db.query(
      "update private.evidence_monitor_state set last_success_at=now()-interval '2 days',last_attempt_at=now()-interval '16 minutes' where organization_id=$1",
      [org],
    );
    assert.equal(
      (await db.query('select private.run_evidence_monitor(1) n')).rows[0].n,
      0,
      'failed organization is contained',
    );
    assert.equal(
      (await as(viewer, 'select * from public.evidence_monitor_status($1)', [org])).rows[0].failed,
      true,
    );
    assert(
      !(await reminders()).some((r) => r.fact_id === failingFact),
      'failed pass rolls back partial reminders',
    );
    await db.query(
      'drop trigger synthetic_monitor_failure on public.evidence_reminders; drop function private.synthetic_monitor_failure()',
    );
    assert.equal(
      (await db.query('select private.run_evidence_monitor(1) n')).rows[0].n,
      0,
      'failure backoff prevents immediate repeated work',
    );
    await db.query(
      "update private.evidence_monitor_state set last_attempt_at=now()-interval '16 minutes' where organization_id=$1",
      [org],
    );
    assert.equal(
      (await db.query('select private.run_evidence_monitor(1) n')).rows[0].n,
      1,
      'retry recovers',
    );
    assert.equal(
      (await as(viewer, 'select * from public.evidence_monitor_status($1)', [org])).rows[0].failed,
      false,
    );
    await assert.rejects(as(admin, 'select * from private.evidence_monitor_state'), /permission/);
    assert(
      (
        await db.query(
          "select count(*)::int n from public.audit_events where organization_id=$1 and entity_table='evidence_reminders' and actor_user_id is null",
          [org],
        )
      ).rows[0].n > 0,
      'system changes audited',
    );
    await db.query("update public.organizations set status='suspended' where id=$1", [org]);
    assert.equal(
      (await db.query('select private.monitor_organization_evidence($1) n', [org])).rows[0].n,
      0,
    );
    assert.equal(
      (await as(admin, 'select * from public.evidence_reminders where organization_id=$1', [org]))
        .rows.length,
      0,
    );
  } finally {
    if (hosted) await db.query('rollback');
    await db.end();
  }
});
