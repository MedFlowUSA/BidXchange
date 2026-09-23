import test from 'node:test';
import assert from 'node:assert/strict';
import { localTestDatabase } from './local-test-db.mjs';
import { validateMigrations } from './staging/prepare.mjs';

test('candidate comparisons are immutable, tenant-scoped and cannot invalidate reviews until human confirmation', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  const owner = '81000000-0000-4000-8000-000000000001',
    viewer = '81000000-0000-4000-8000-000000000002',
    foreign = '81000000-0000-4000-8000-000000000003';
  const row = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const as = async (user, sql, args = []) => {
    await db.query('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    try {
      return await db.query(sql, args);
    } finally {
      await db.query('reset role');
    }
  };
  try {
    await db.query('create role service_role');
    for (const m of validateMigrations('supabase/migrations').filter(
      (m) => m.file > '20260919000499',
    ))
      await db.query(m.sql);
    await db.query('insert into auth.users(id) values($1),($2),($3)', [owner, viewer, foreign]);
    const org = (
      await row(
        "insert into public.organizations(legal_name,operating_name,slug) values('Fictional Diff','Fictional Diff','diff-test') returning id",
      )
    ).id;
    const other = (
      await row(
        "insert into public.organizations(legal_name,operating_name,slug) values('Other Fictional','Other Fictional','other-diff-test') returning id",
      )
    ).id;
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin'),($1,$3,'viewer'),($4,$5,'organization_admin')",
      [org, owner, viewer, other, foreign],
    );
    await db.query('insert into public.company_profiles(organization_id) values($1)', [org]);
    const opp = (
      await row(
        "insert into public.opportunities(organization_id,title) values($1,'Fictional retrofit') returning id",
        [org],
      )
    ).id;
    const pursuit = (
      await row(
        "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Fictional retrofit') returning id",
        [org, opp],
      )
    ).id;
    const req = (
      await row(
        "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation,status) values($1,$2,'Bid bond','Section 1','blocked') returning id",
        [org, pursuit],
      )
    ).id;
    const context = async () =>
      (await as(owner, 'select public.decision_memory_context($1,$2) token', [org, opp])).rows[0]
        .token;
    const decisionContext = (
      await as(owner, 'select public.pursuit_decision_context($1,$2) token', [org, pursuit])
    ).rows[0].token;
    await as(owner, 'select public.sign_off_requirements_register($1,$2,$3,$4)', [
      org,
      pursuit,
      decisionContext,
      'Human reviewed original source',
    ]);
    await as(owner, 'select public.record_company_decision($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
      org,
      pursuit,
      (await row('select updated_at from public.pursuits where id=$1', [pursuit])).updated_at,
      decisionContext,
      'no_bid',
      'Fictional bond gap',
      '',
      ['bond'],
      2,
    ]);
    const savedDecision = await row(
      'select * from public.pursuit_decision_history where organization_id=$1',
      [org],
    );
    const candidates = ['license', 'bond', 'insurance', 'deadline', 'meeting', 'scope'].map(
      (field) => ({
        field,
        label: field,
        before: field === 'bond' ? [{ text: 'Bid bond: 5%.', line: 1 }] : [],
        after: field === 'bond' ? [{ text: 'Bid bond: 10%.', line: 1 }] : [],
        status: field === 'bond' ? 'changed' : 'unknown',
        suggestedRequirementIds: field === 'bond' ? [req] : [],
      }),
    );
    const save = 'select public.save_amendment_comparison($1,$2,$3,$4,$5,$6,$7,$8,$9) id';
    const args = async () => [
      org,
      opp,
      await context(),
      'Amendment 1',
      'https://example.gov/original',
      'https://example.gov/amended',
      'Bid bond: 5%.',
      'Bid bond: 10%.',
      JSON.stringify(candidates),
    ];
    await assert.rejects(as(viewer, save, await args()), /Capture access/);
    await assert.rejects(as(foreign, save, await args()), /Capture access/);
    const before = await context();
    const id = (await as(owner, save, await args())).rows[0].id;
    assert.equal(await context(), before);
    assert.equal(
      (await row('select status from public.pursuit_requirements where id=$1', [req])).status,
      'blocked',
    );
    assert.equal((await row('select count(*)::int n from public.opportunity_amendments')).n, 0);
    await assert.rejects(
      as(owner, "update public.amendment_comparisons set original_text='rewrite' where id=$1", [
        id,
      ]),
      /permission denied/,
    );
    assert.equal((await as(viewer, 'select * from public.amendment_comparisons')).rows.length, 0);
    assert.equal((await as(foreign, 'select * from public.amendment_comparisons')).rows.length, 0);
    const invalid = structuredClone(candidates);
    invalid[1].after[0].text = 'Invented quote';
    await assert.rejects(
      as(owner, save, [...(await args()).slice(0, 8), JSON.stringify(invalid)]),
      /quotation/,
    );
    const confirm = 'select public.confirm_amendment_comparison($1,$2,$3,$4,$5,$6) id';
    const ca = [org, id, 'confirmed', 'Human confirmed the increased bond', [req], true];
    await assert.rejects(as(viewer, confirm, ca), /Capture access/);
    await assert.rejects(as(foreign, confirm, ca), /Capture access/);
    await assert.rejects(as(owner, confirm, [...ca.slice(0, 5), false]), /Human review/);
    await assert.rejects(
      as(owner, confirm, [...ca.slice(0, 4), [foreign], true]),
      /Requirement not/,
    );
    const review = (await as(owner, confirm, ca)).rows[0].id;
    assert.equal((await as(owner, confirm, ca)).rows[0].id, review);
    assert.equal((await row('select count(*)::int n from public.opportunity_amendments')).n, 1);
    assert.equal(
      (await row('select status from public.pursuit_requirements where id=$1', [req])).status,
      'needs_review',
    );
    assert.notEqual(await context(), before);
    assert.deepEqual(
      await row('select * from public.pursuit_decision_history where id=$1', [savedDecision.id]),
      savedDecision,
    );
    const stored = await row('select * from public.amendment_comparisons where id=$1', [id]);
    assert.equal(stored.original_text, 'Bid bond: 5%.');
    assert.equal((await row('select reviewed from public.opportunity_amendments')).reviewed, false);
    const id2 = (await as(owner, save, await args())).rows[0].id;
    await db.query(
      "update public.pursuit_requirements set requirement='New bond threshold' where id=$1",
      [req],
    );
    await assert.rejects(
      as(owner, confirm, [org, id2, 'confirmed', 'Review', [req], true]),
      /Records changed/,
    );
    await as(owner, confirm, [org, id2, 'dismissed', 'Replaced by new source', [], true]);
    assert.equal((await row('select count(*)::int n from public.opportunity_amendments')).n, 1);
    await assert.rejects(
      as(owner, 'delete from public.amendment_comparison_reviews'),
      /permission denied/,
    );
  } finally {
    await db.end();
  }
});
