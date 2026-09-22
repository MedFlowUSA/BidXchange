import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localTestDatabase } from './local-test-db.mjs';
import { stagingDatabase } from './staging/connection.mjs';
import pg from 'pg';
test('register sign-off gates both final decisions, preserves history, invalidates after changes and denies tenant/role bypass', async () => {
  const staging = process.env.BIDXCHANGE_CONTRACTOR_TEST_STAGING === '1';
  if (staging) pg.types.setTypeParser(1184, (value) => value);
  const db = staging
    ? await stagingDatabase()
    : await localTestDatabase({ includeCompanySeed: false });
  if (staging) {
    await db.query('begin');
    const query = db.query.bind(db);
    db.query = async (sql, args) => {
      if (sql === 'rollback') return query(sql, args);
      await query('savepoint synthetic_check');
      try {
        const result = await query(sql, args);
        await query('release savepoint synthetic_check');
        return result;
      } catch (error) {
        await query('rollback to savepoint synthetic_check');
        await query('release savepoint synthetic_check');
        throw error;
      }
    };
  }
  try {
    for (const file of staging
      ? []
      : [
          '20260919000500_ai_readonly.sql',
          '20260919000700_evidence_use_reviews.sql',
          '20260919000800_evidence_review_grants.sql',
          '20260919000900_evidence_review_conflict.sql',
          '20260920001000_pursuit_decisions.sql',
          '20260920001100_requirement_resolutions.sql',
          '20260921002100_requirements_register_signoff.sql',
        ])
      await db.query(readFileSync('supabase/migrations/' + file, 'utf8'));
    for (const file of staging
      ? []
      : [
          '20260921001600_structured_company_profiles.sql',
          '20260921001800_company_source_capabilities.sql',
          '20260921002000_california_passport_catalog.sql',
          '20260921002200_contractor_tasks_amendments.sql',
          '20260921002300_evidence_freshness_radar.sql',
          '20260921002400_requirement_not_applicable.sql',
          '20260921002600_monotonic_record_versions.sql',
        ])
      await db.query(readFileSync('supabase/migrations/' + file, 'utf8'));
    const admin = '80000000-0000-4000-8000-000000000001',
      viewer = '80000000-0000-4000-8000-000000000002',
      foreign = '80000000-0000-4000-8000-000000000003';
    await db.query('insert into auth.users(id) values($1),($2),($3)', [admin, viewer, foreign]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Synthetic','Synthetic','register-test') returning id",
      )
    ).rows[0].id;
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin'),($1,$3,'viewer')",
      [org, admin, viewer],
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
    const req = (
      await db.query(
        "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation) values($1,$2,'Confirm license scope','Synthetic section 1') returning id",
        [org, pursuit],
      )
    ).rows[0].id;
    async function as(user, sql, args) {
      await db.query('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      try {
        return await db.query(sql, args);
      } finally {
        await db.query(staging ? 'set role postgres' : 'reset role');
      }
    }
    const context = async () =>
      (await as(admin, 'select public.pursuit_decision_context($1,$2) token', [org, pursuit]))
        .rows[0].token;
    const decisionArgs = async (outcome) => [
      org,
      pursuit,
      (await db.query('select updated_at from public.pursuits where id=$1', [pursuit])).rows[0]
        .updated_at,
      await context(),
      outcome,
      'Human reason',
      'Human conditions',
    ];
    const decide = 'select public.record_pursuit_decision($1,$2,$3,$4,$5,$6,$7)';
    await assert.rejects(as(admin, decide, await decisionArgs('bid')), /sign-off/);
    await assert.rejects(as(admin, decide, await decisionArgs('no_bid')), /sign-off/);
    await as(admin, decide, await decisionArgs('pending'));
    await as(admin, 'select public.record_pursuit_decision($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
      ...(await decisionArgs('leaning_bid')),
      ['capacity', 'strategic'],
      12.5,
    ]);
    const preliminary = (
      await as(
        viewer,
        'select * from public.pursuit_decision_history order by decided_at desc limit 1',
      )
    ).rows[0];
    assert.equal(preliminary.decision, 'pending');
    assert.equal(preliminary.preliminary_state, 'leaning_bid');
    assert.deepEqual(preliminary.reason_codes, ['capacity', 'strategic']);
    assert.equal(Number(preliminary.estimated_pursuit_hours), 12.5);
    const requirementVersion = (
      await db.query('select updated_at from public.pursuit_requirements where id=$1', [req])
    ).rows[0].updated_at;
    const resolve = "select public.resolve_pursuit_requirement($1,$2,$3,null,$4,$5,null,'','')";
    await assert.rejects(
      as(admin, resolve, [org, req, requirementVersion, 'not_applicable', '']),
      /reason/,
    );
    await assert.rejects(
      as(viewer, resolve, [org, req, requirementVersion, 'not_applicable', 'Synthetic reason']),
      /reviewer/,
    );
    await as(admin, resolve, [
      org,
      req,
      requirementVersion,
      'not_applicable',
      'Synthetic source requirement applies only to an excluded alternate',
    ]);
    const sign = 'select public.sign_off_requirements_register($1,$2,$3,$4)';
    await assert.rejects(as(viewer, sign, [org, pursuit, await context(), 'Reviewed']), /reviewer/);
    await assert.rejects(
      as(foreign, sign, [org, pursuit, await context(), 'Reviewed']),
      /reviewer/,
    );
    await as(admin, sign, [
      org,
      pursuit,
      await context(),
      'I reviewed the original notice and outstanding gaps',
    ]);
    await as(admin, decide, await decisionArgs('bid'));
    const finalMemo = (
      await as(
        viewer,
        'select * from public.pursuit_decision_history order by decided_at desc limit 1',
      )
    ).rows[0];
    assert.ok(finalMemo.register_signoff_id);
    assert.equal(finalMemo.review_snapshot.requirements.length, 1);
    const history = (
      await as(viewer, 'select * from public.pursuit_decision_history order by decided_at')
    ).rows;
    await as(
      admin,
      "update public.pursuit_requirements set requirement='Amended scope' where id=$1",
      [req],
    );
    await assert.rejects(as(admin, decide, await decisionArgs('bid')), /sign-off/);
    assert.deepEqual(
      (await as(viewer, 'select * from public.pursuit_decision_history order by decided_at')).rows,
      history,
    );
    assert.equal(
      (await as(foreign, 'select * from public.requirements_register_signoffs')).rows.length,
      0,
    );
    await assert.rejects(
      as(
        admin,
        'select private.record_pursuit_decision($1,$2,$3,$4,$5,$6,$7)',
        await decisionArgs('bid'),
      ),
      /permission denied/,
    );
    await assert.rejects(
      as(admin, 'delete from public.requirements_register_signoffs'),
      /permission denied/,
    );
    await as(admin, sign, [org, pursuit, await context(), 'Reaffirm after scope change']);
    await as(
      admin,
      "insert into public.opportunity_amendments(organization_id,opportunity_id,label,source_url,summary) values($1,$2,'Addendum 1','https://example.test/notice','Synthetic change')",
      [org, opp],
    );
    await assert.rejects(as(admin, decide, await decisionArgs('no_bid')), /sign-off/);
    await assert.rejects(
      as(admin, sign, [org, pursuit, await context(), 'Review pending amendment']),
      /amendments/,
    );
    const amendment = (
      await as(
        admin,
        'select id,updated_at from public.opportunity_amendments where organization_id=$1',
        [org],
      )
    ).rows[0];
    await as(admin, 'update public.opportunity_amendments set reviewed=true where id=$1', [
      amendment.id,
    ]);
    const reviewed = (
      await as(
        admin,
        'select reviewed_by,reviewed_at from public.opportunity_amendments where id=$1',
        [amendment.id],
      )
    ).rows[0];
    assert.equal(reviewed.reviewed_by, admin);
    assert.ok(reviewed.reviewed_at);
    assert.equal(
      (await db.query('select status from public.pursuit_requirements where id=$1', [req])).rows[0]
        .status,
      'needs_review',
    );
    const profile = (
      await db.query(
        'insert into public.company_profiles(organization_id) values($1) returning id',
        [org],
      )
    ).rows[0].id;
    const fact = (
      await as(
        admin,
        "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value,source_reference,sensitivity,expiration_date) values($1,$2,'insurance','Synthetic GL','Synthetic coverage','Synthetic source','restricted',current_date-1) returning id",
        [org, profile],
      )
    ).rows[0].id;
    await as(
      admin,
      "insert into public.evidence_use_reviews(organization_id,requirement_id,fact_id,fact_version,requirement_version,applicability,proposal_use,reason) select $1,r.id,f.id,f.updated_at,r.updated_at,'unknown','not_approved','Review expired policy' from public.profile_facts f,public.pursuit_requirements r where f.id=$2 and r.id=$3",
      [org, fact, req],
    );
    assert.equal(
      (await as(admin, 'select public.refresh_pursuit_evidence_freshness($1,$2) n', [org, pursuit]))
        .rows[0].n,
      1,
    );
    assert.equal(
      (await as(admin, 'select public.refresh_pursuit_evidence_freshness($1,$2) n', [org, pursuit]))
        .rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::integer n from public.pursuit_tasks where requirement_id=$1',
          [req],
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      as(foreign, 'select public.refresh_pursuit_evidence_freshness($1,$2)', [org, pursuit]),
      /access/,
    );
    assert.deepEqual(
      (await as(viewer, 'select * from public.pursuit_decision_history order by decided_at')).rows,
      history,
    );
  } finally {
    if (staging) await db.query('rollback');
    await db.end();
  }
});
