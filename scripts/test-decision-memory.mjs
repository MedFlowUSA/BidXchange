import test from 'node:test';
import assert from 'node:assert/strict';
import { localTestDatabase } from './local-test-db.mjs';
import { validateMigrations } from './staging/prepare.mjs';
test('migration links legacy history without inventing historical notice details or changing timestamps', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  try {
    await db.query('create role service_role');
    const migrations = validateMigrations('supabase/migrations').filter(
      (m) => m.file > '20260919000499',
    );
    for (const m of migrations.slice(0, -1)) await db.query(m.sql);
    const user = '72000000-0000-4000-8000-000000000001';
    await db.query('insert into auth.users(id) values($1)', [user]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Legacy fictional','Legacy fictional','legacy-memory') returning id",
      )
    ).rows[0].id;
    const profile = (
      await db.query(
        'insert into public.company_profiles(organization_id) values($1) returning id',
        [org],
      )
    ).rows[0].id;
    const opp = (
      await db.query(
        "insert into public.opportunities(organization_id,title) values($1,'Current title is not historical evidence') returning id",
        [org],
      )
    ).rows[0].id;
    const pursuit = (
      await db.query(
        "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Legacy') returning id",
        [org, opp],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.pursuit_decision_history(organization_id,pursuit_id,decision,reason,conditions,context_token,decided_by,decided_at) values($1,$2,'no_bid','Old rationale','','old',$3,'2020-01-01T00:00:00Z')",
      [org, pursuit, user],
    );
    const before = (await db.query('select * from public.pursuit_decision_history')).rows[0];
    await db.query(migrations.at(-1).sql);
    const after = (await db.query('select * from public.pursuit_decision_history')).rows[0];
    assert.equal(after.company_profile_id, profile);
    assert.equal(after.opportunity_snapshot, null);
    assert.equal(after.match_features, null);
    assert.deepEqual(after.decided_at, before.decided_at);
    assert.equal(after.reason, before.reason);
  } finally {
    await db.end();
  }
});
test('Decision Log preserves history, scopes matching and requires current human reassessment', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  const admin = '71000000-0000-4000-8000-000000000001',
    viewer = '71000000-0000-4000-8000-000000000002',
    other = '71000000-0000-4000-8000-000000000003';
  try {
    await db.query('create role service_role');
    for (const m of validateMigrations('supabase/migrations').filter(
      (m) => m.file > '20260919000499',
    ))
      await db.query(m.sql);
    await db.query('insert into auth.users(id) values($1),($2),($3)', [admin, viewer, other]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Fictional Electric','Fictional Electric','memory-test') returning id",
      )
    ).rows[0].id;
    const foreign = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Other Fictional','Other Fictional','other-memory-test') returning id",
      )
    ).rows[0].id;
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin'),($1,$3,'viewer'),($4,$5,'organization_admin')",
      [org, admin, viewer, foreign, other],
    );
    const profile = (
      await db.query(
        'insert into public.company_profiles(organization_id) values($1) returning id',
        [org],
      )
    ).rows[0].id;
    const opp = (
      await db.query(
        "insert into public.opportunities(organization_id,title,buyer,summary) values($1,'C-10 lighting','Example City','Bid bond and mandatory job walk') returning id",
        [org],
      )
    ).rows[0].id;
    const pursuit = (
      await db.query(
        "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Fictional lighting') returning id",
        [org, opp],
      )
    ).rows[0].id;
    const requirement = (
      await db.query(
        "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation,status) values($1,$2,'Bid bond required','Section 4','blocked') returning id",
        [org, pursuit],
      )
    ).rows[0].id;
    const as = async (user, sql, args = []) => {
      await db.query('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      try {
        return await db.query(sql, args);
      } finally {
        await db.query('reset role');
      }
    };
    const context = async () =>
      (await as(admin, 'select public.pursuit_decision_context($1,$2) token', [org, pursuit]))
        .rows[0].token;
    const version = async () =>
      (await db.query('select updated_at from public.pursuits where id=$1', [pursuit])).rows[0]
        .updated_at;
    const decisionSql = 'select public.record_company_decision($1,$2,$3,$4,$5,$6,$7,$8,$9) id';
    const args = async (reasons = ['bond', 'site_visit']) => [
      org,
      pursuit,
      await version(),
      await context(),
      'no_bid',
      'Human: capacity and meeting conflict',
      '',
      reasons,
      4,
    ];
    await assert.rejects(as(admin, decisionSql, await args()), /sign-off/);
    await as(admin, 'select public.sign_off_requirements_register($1,$2,$3,$4)', [
      org,
      pursuit,
      await context(),
      'Reviewed all candidate requirements',
    ]);
    await assert.rejects(as(viewer, decisionSql, await args()), /human decision maker/);
    await assert.rejects(as(admin, decisionSql, await args([])), /at least one/);
    const id = (await as(admin, decisionSql, await args())).rows[0].id;
    const saved = (
      await db.query('select * from public.pursuit_decision_history where id=$1', [id])
    ).rows[0];
    assert.equal(saved.company_profile_id, profile);
    assert.deepEqual(saved.reason_codes, ['bond', 'site_visit']);
    assert(saved.match_features.includes('agency:example city'));
    assert(saved.match_features.includes('trade:c-10'));
    assert.equal(saved.review_snapshot.requirements[0].text, 'Bid bond required');
    await db.query(
      "update public.pursuit_requirements set requirement='New later language' where id=$1",
      [requirement],
    );
    await db.query(
      "update public.opportunities set title='Changed later title',buyer='Changed buyer' where id=$1",
      [opp],
    );
    assert.deepEqual(
      (
        await db.query(
          'select opportunity_snapshot,review_snapshot from public.pursuit_decision_history where id=$1',
          [id],
        )
      ).rows[0],
      { opportunity_snapshot: saved.opportunity_snapshot, review_snapshot: saved.review_snapshot },
    );
    await assert.rejects(
      as(admin, "update public.pursuit_decision_history set reason='overwrite' where id=$1", [id]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("update public.pursuit_decision_history set opportunity_snapshot='{}' where id=$1", [
        id,
      ]),
      /immutable/,
    );
    const target = (
      await db.query(
        "insert into public.opportunities(organization_id,title,buyer,summary) values($1,'C-10 retrofit','EXAMPLE CITY','Insurance and bond required') returning id",
        [org],
      )
    ).rows[0].id;
    const result = (
      await as(viewer, 'select public.similar_no_bid_decisions($1,$2) result', [org, target])
    ).rows[0].result;
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].id, id);
    assert(result.matches[0].matched_features.includes('agency:example city'));
    const same = (
      await as(admin, 'select public.similar_no_bid_decisions($1,$2) result', [org, opp])
    ).rows[0].result;
    assert.equal(same.matches.length, 0);
    await assert.rejects(
      as(other, 'select public.similar_no_bid_decisions($1,$2)', [org, target]),
      /Workspace access/,
    );
    assert.equal((await as(other, 'select * from public.pursuit_decision_history')).rows.length, 0);
    const reviewSql = 'select public.review_decision_memory($1,$2,$3,$4,$5,$6,$7,$8,$9) id';
    const reviewArgs = [
      org,
      id,
      target,
      'bond',
      'resolved',
      'Human checked the new notice',
      'Bond letter reference only',
      result.context,
      null,
    ];
    await assert.rejects(as(viewer, reviewSql, reviewArgs), /human reviewer/);
    await assert.rejects(as(other, reviewSql, reviewArgs), /human reviewer/);
    const review = (await as(admin, reviewSql, reviewArgs)).rows[0].id;
    await assert.rejects(as(admin, reviewSql, reviewArgs), /Assessment changed/);
    const current = (
      await as(viewer, 'select * from public.current_decision_memory_reviews($1,$2,$3)', [
        org,
        target,
        [id],
      ])
    ).rows;
    assert.equal(current[0].id, review);
    assert.equal(current[0].context_token, result.context);
    // One resolved reason never creates a review for another reason.
    assert.equal(current.length, 1);
    assert.equal(current[0].reason_code, 'bond');
    await db.query("update public.opportunities set summary='New bond amount' where id=$1", [
      target,
    ]);
    const next = (
      await as(admin, 'select public.decision_memory_context($1,$2) token', [org, target])
    ).rows[0].token;
    assert.notEqual(next, result.context);
    await assert.rejects(
      as(admin, reviewSql, [...reviewArgs.slice(0, 8), review]),
      /Records changed/,
    );
    const replacement = (
      await as(admin, reviewSql, [
        ...reviewArgs.slice(0, 4),
        'still_unresolved',
        ...reviewArgs.slice(5, 7),
        next,
        review,
      ])
    ).rows[0].id;
    assert.notEqual(replacement, review);
    assert.equal(
      (await db.query('select count(*)::int n from public.decision_memory_reviews')).rows[0].n,
      2,
    );
    assert.equal((await as(other, 'select * from public.decision_memory_reviews')).rows.length, 0);
    await assert.rejects(
      as(admin, 'delete from public.decision_memory_reviews'),
      /permission denied/,
    );
    // A Passport edit changes the review context without editing the old review or decision.
    await db.query(
      "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value) values($1,$2,'bonding','Synthetic bond','Unreviewed update')",
      [org, profile],
    );
    assert.notEqual(
      (await as(admin, 'select public.decision_memory_context($1,$2) token', [org, target])).rows[0]
        .token,
      next,
    );
    assert.deepEqual(
      (
        await db.query('select review_snapshot from public.pursuit_decision_history where id=$1', [
          id,
        ])
      ).rows[0].review_snapshot,
      saved.review_snapshot,
    );
  } finally {
    await db.end();
  }
});
