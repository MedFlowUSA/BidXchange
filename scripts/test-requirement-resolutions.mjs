import test from 'node:test';
import assert from 'node:assert/strict';
import { localTestDatabase } from './local-test-db.mjs';
import { validateMigrations } from './staging/prepare.mjs';
test('requirement resolutions enforce evidence, waiver authority, immutable history and current context', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  const admin = '90000000-0000-4000-8000-000000000001',
    exec = '90000000-0000-4000-8000-000000000002',
    viewer = '90000000-0000-4000-8000-000000000003',
    foreign = '90000000-0000-4000-8000-000000000004';
  try {
    await db.query('create role service_role');
    for (const m of validateMigrations('supabase/migrations').filter(
      (m) => m.file > '20260919000499',
    )) {
      if (m.file === '20260920001100_requirement_resolutions.sql')
        await db.query(
          'alter default privileges in schema public grant all on tables to anon,authenticated; alter default privileges in schema public grant all on sequences to anon,authenticated',
        );
      await db.query(m.sql);
    }
    await db.query('insert into auth.users(id) values($1),($2),($3),($4)', [
      admin,
      exec,
      viewer,
      foreign,
    ]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Synthetic','Synthetic','resolution-test') returning id",
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
    const req = (
      await db.query(
        "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation,status) values($1,$2,'License','Section 2','blocked') returning id",
        [org, pursuit],
      )
    ).rows[0].id;
    const profile = (
      await db.query(
        'insert into public.company_profiles(organization_id) values($1) returning id',
        [org],
      )
    ).rows[0].id;
    const fact = (
      await db.query(
        "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value,source_reference,sensitivity) values($1,$2,'license','License','B','Registry','restricted') returning id",
        [org, profile],
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
    const version = async () =>
      (await db.query('select updated_at from public.pursuit_requirements where id=$1', [req]))
        .rows[0].updated_at;
    const current = async () =>
      (await as(admin, 'select * from public.current_requirement_resolutions')).rows[0];
    const context = async () =>
      (await as(admin, 'select public.pursuit_decision_context($1,$2) token', [org, pursuit]))
        .rows[0].token;
    const sql = 'select public.resolve_pursuit_requirement($1,$2,$3,$4,$5,$6,$7,$8,$9) id';
    const args = async (outcome = 'blocked', evidence = null) => [
      org,
      req,
      await version(),
      (await current())?.id ?? null,
      outcome,
      'Synthetic rationale',
      evidence,
      'Buyer contracting officer',
      'Amendment 2 section 3',
    ];
    await assert.rejects(as(viewer, sql, await args()));
    await assert.rejects(as(foreign, sql, await args()));
    await assert.rejects(as(admin, sql, await args('supported')), /approved evidence/);
    await assert.rejects(as(admin, sql, await args('waived')), /Executive review/);
    const missingAuthority = await args('waived');
    missingAuthority[7] = '';
    await assert.rejects(as(exec, sql, missingAuthority), /documented issuing authority/);
    const token = await context(),
      stale = await args();
    await as(admin, sql, stale);
    assert.notEqual(await context(), token);
    assert.equal((await current()).disposition, 'blocked');
    assert.equal((await current()).review_current, true);
    await assert.rejects(as(admin, sql, stale), /Review changed/);
    await as(admin, "update public.profile_facts set verification_status='verified' where id=$1", [
      fact,
    ]);
    const factVersion = (
      await db.query('select updated_at from public.profile_facts where id=$1', [fact])
    ).rows[0].updated_at;
    const review = (
      await as(
        admin,
        "insert into public.evidence_use_reviews(organization_id,requirement_id,fact_id,fact_version,requirement_version,applicability,proposal_use,reason) values($1,$2,$3,$4,$5,'applicable','approved','Synthetic evidence assessment') returning id",
        [org, req, fact, factVersion, await version()],
      )
    ).rows[0].id;
    const originalVersion = await version();
    await as(admin, sql, await args('supported', review));
    assert.equal((await current()).review_current, true);
    assert.equal((await current()).reviewed_by, admin);
    assert.deepEqual(await version(), originalVersion);
    assert.equal(
      (await as(admin, 'select approval_current from public.current_evidence_use_reviews')).rows[0]
        .approval_current,
      true,
    );
    const visible = (await as(viewer, 'select * from public.current_requirement_resolutions'))
      .rows[0];
    assert.equal(visible.disposition, 'supported');
    assert(!('evidence_review_id' in visible));
    assert.equal((await as(viewer, 'select id from public.evidence_use_reviews')).rows.length, 0);
    assert.equal(
      (await as(foreign, 'select * from public.current_requirement_resolutions')).rows.length,
      0,
    );
    await assert.rejects(
      as(admin, 'select evidence_review_id from public.requirement_resolution_history'),
      /permission denied/,
    );
    await assert.rejects(
      as(admin, 'delete from public.requirement_resolution_history'),
      /permission denied/,
    );
    await assert.rejects(
      as(admin, "update public.requirement_resolution_history set reason='forged'"),
      /permission denied/,
    );
    await assert.rejects(
      as(admin, 'insert into public.requirement_resolution_history default values'),
      /permission denied/,
    );
    await as(admin, "update public.profile_facts set source_note='Corrected' where id=$1", [fact]);
    assert.equal((await current()).review_current, false);
    await assert.rejects(as(admin, sql, await args('supported', review)), /approved evidence/);
    await as(exec, sql, await args('waived'));
    assert.equal((await current()).review_current, true);
    await db.query(
      "update public.organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",
      [org, exec],
    );
    assert.equal((await current()).review_current, false);
    await as(admin, sql, await args('awaiting_clarification'));
    const staleRequirement = await args('blocked');
    await as(
      admin,
      "update public.pursuit_requirements set citation='Section 4 amended' where id=$1",
      [req],
    );
    assert.equal((await current()).review_current, false);
    await assert.rejects(as(admin, sql, staleRequirement), /Requirement changed/);
    await as(admin, sql, await args('needs_review'));
    const grants = (
      await db.query(
        "select has_table_privilege('anon','public.current_requirement_resolutions','SELECT') anon_read,has_table_privilege('authenticated','public.current_requirement_resolutions','UPDATE') can_update,has_sequence_privilege('authenticated','public.requirement_resolution_history_sequence_seq','USAGE') sequence_access",
      )
    ).rows[0];
    assert.deepEqual(grants, { anon_read: false, can_update: false, sequence_access: false });
  } finally {
    await db.end();
  }
});
