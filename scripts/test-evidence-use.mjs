import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localTestDatabase } from './local-test-db.mjs';

test('evidence use is tenant-scoped, version-bound, human-attributed and invalidated by source edits', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  const admin = '70000000-0000-4000-8000-000000000001',
    viewer = '70000000-0000-4000-8000-000000000002',
    foreign = '70000000-0000-4000-8000-000000000003';
  try {
    await db.query(readFileSync('supabase/migrations/20260919000500_ai_readonly.sql', 'utf8'));
    await db.query(
      readFileSync('supabase/migrations/20260919000700_evidence_use_reviews.sql', 'utf8'),
    );
    await db.query(
      readFileSync('supabase/migrations/20260919000800_evidence_review_grants.sql', 'utf8'),
    );
    await db.query(
      readFileSync('supabase/migrations/20260919000900_evidence_review_conflict.sql', 'utf8'),
    );
    await db.query(
      readFileSync('supabase/migrations/20260921001600_structured_company_profiles.sql', 'utf8'),
    );
    await db.query('insert into auth.users(id) values($1),($2),($3)', [admin, viewer, foreign]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Synthetic','Synthetic','synthetic-review') returning id",
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
    const fact = (
      await db.query(
        "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value,source_reference,sensitivity) values($1,$2,'license','Synthetic license','B','Registry','restricted') returning id",
        [org, profile],
      )
    ).rows[0].id;
    const opportunity = (
      await db.query(
        "insert into public.opportunities(organization_id,title) values($1,'Synthetic') returning id",
        [org],
      )
    ).rows[0].id;
    const pursuit = (
      await db.query(
        "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Synthetic') returning id",
        [org, opportunity],
      )
    ).rows[0].id;
    const requirement = (
      await db.query(
        "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation) values($1,$2,'B license','Section 2') returning id",
        [org, pursuit],
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
    const versions = async () => [
      (await db.query('select updated_at from public.profile_facts where id=$1', [fact])).rows[0]
        .updated_at,
      (
        await db.query('select updated_at from public.pursuit_requirements where id=$1', [
          requirement,
        ])
      ).rows[0].updated_at,
    ];
    const insert =
      "insert into public.evidence_use_reviews(organization_id,requirement_id,fact_id,fact_version,requirement_version,applicability,proposal_use,reason) values($1,$2,$3,$4,$5,$6,$7,'Synthetic review') returning id,reviewed_by";
    const args = async (app = 'applicable', use = 'approved') => [
      org,
      requirement,
      fact,
      ...(await versions()),
      app,
      use,
    ];
    await assert.rejects(as(viewer, insert, await args()));
    await assert.rejects(as(foreign, insert, await args()));
    await assert.rejects(as(admin, insert, await args()), /Current verified evidence/);
    await as(admin, "update public.profile_facts set verification_status='verified' where id=$1", [
      fact,
    ]);
    await assert.rejects(as(admin, insert, await args('unknown')), /Current verified evidence/);
    const approved = (await as(admin, insert, await args())).rows[0];
    assert.equal(approved.reviewed_by, admin);
    const current = async () =>
      (await as(admin, 'select * from public.current_evidence_use_reviews')).rows[0];
    assert.equal((await current()).approval_current, true);
    await db.query("insert into auth.users(id) values('70000000-0000-4000-8000-000000000004')");
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,'70000000-0000-4000-8000-000000000004','organization_admin')",
      [org],
    );
    await db.query(
      "update public.organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",
      [org, admin],
    );
    assert.equal(
      (await db.query('select approval_current from public.current_evidence_use_reviews')).rows[0]
        .approval_current,
      false,
    );
    await assert.rejects(as(admin, insert, await args()));
    await db.query(
      "update public.organization_memberships set role='organization_admin' where organization_id=$1 and user_id=$2",
      [org, admin],
    );
    await assert.rejects(
      as(
        admin,
        insert
          .replace('reason)', 'reason,reviewed_by)')
          .replace("'Synthetic review')", "'Synthetic review',$8)"),
        [...(await args()), viewer],
      ),
      /permission denied/,
    );
    assert.equal((await as(viewer, 'select * from public.evidence_use_reviews')).rows.length, 0);
    assert.equal(
      (await as(foreign, 'select * from public.current_evidence_use_reviews')).rows.length,
      0,
    );
    await assert.rejects(
      as(admin, "update public.evidence_use_reviews set reason='changed'"),
      /permission denied/,
    );
    await assert.rejects(as(admin, 'delete from public.evidence_use_reviews'), /permission denied/);
    const stale = await args();
    await as(
      admin,
      "update public.profile_facts set source_note='Corrected source note' where id=$1",
      [fact],
    );
    assert.equal(
      (await db.query('select verification_status from public.profile_facts where id=$1', [fact]))
        .rows[0].verification_status,
      'pending_verification',
    );
    assert.equal((await current()).approval_current, false);
    await assert.rejects(as(admin, insert, stale), /changed/);
    await as(admin, "update public.profile_facts set verification_status='verified' where id=$1", [
      fact,
    ]);
    await as(admin, insert, await args());
    assert.equal((await current()).approval_current, true);
    await as(
      admin,
      "update public.pursuit_requirements set citation='Section 3 amended' where id=$1",
      [requirement],
    );
    assert.equal((await current()).approval_current, false);
    await as(admin, insert, await args('not_applicable', 'not_approved'));
    assert.equal((await current()).applicability, 'not_applicable');
    assert.equal((await current()).approval_current, false);
    await as(admin, "update public.profile_facts set expiration_date='2020-01-01' where id=$1", [
      fact,
    ]);
    await as(admin, "update public.profile_facts set verification_status='verified' where id=$1", [
      fact,
    ]);
    await assert.rejects(as(admin, insert, await args()), /Current verified evidence/);
  } finally {
    await db.end();
  }
});
