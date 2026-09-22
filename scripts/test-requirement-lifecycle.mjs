import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { localTestDatabase } from './local-test-db.mjs';
import { validateMigrations } from './staging/prepare.mjs';
import { stagingDatabase } from './staging/connection.mjs';

test('requirement lifecycle preserves records, blocks bypasses and invalidates reviewed context', async () => {
  const hosted = process.env.BIDXCHANGE_LIFECYCLE_TEST_STAGING === '1';
  pg.types.setTypeParser(1184, (v) => v);
  const db = hosted
    ? await stagingDatabase()
    : await localTestDatabase({ includeCompanySeed: false });
  if (hosted) {
    await db.query('begin');
    const query = db.query.bind(db);
    db.query = async (sql, args) => {
      if (sql === 'rollback') return query(sql);
      await query('savepoint lifecycle_test');
      try {
        const r = await query(sql, args);
        await query('release savepoint lifecycle_test');
        return r;
      } catch (e) {
        await query('rollback to savepoint lifecycle_test');
        await query('release savepoint lifecycle_test');
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
      [
        'organization_admin',
        'capture_manager',
        'executive_approver',
        'viewer',
        'estimator',
        'foreign',
      ].map((role) => [role, randomUUID()]),
    );
    for (const id of Object.values(users))
      await db.query('insert into auth.users(id) values($1)', [id]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Synthetic lifecycle','Synthetic lifecycle',$1) returning id",
        ['lifecycle-' + randomUUID()],
      )
    ).rows[0].id;
    const other = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Other synthetic','Other synthetic',$1) returning id",
        ['other-' + randomUUID()],
      )
    ).rows[0].id;
    for (const [role, id] of Object.entries(users))
      await db.query(
        'insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,$3)',
        [role === 'foreign' ? other : org, id, role === 'foreign' ? 'organization_admin' : role],
      );
    const opp = (
      await db.query(
        "insert into public.opportunities(organization_id,title,solicitation_number,source_url,official_deadline,deadline_timezone) values($1,'Training notice','DEMO','https://example.invalid/notice',now()+interval '10 days','UTC') returning id",
        [org],
      )
    ).rows[0].id;
    const pursuit = (
      await db.query(
        "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Training pursuit') returning id",
        [org, opp],
      )
    ).rows[0].id;
    const otherPursuit = (
      await db.query(
        "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Other training pursuit') returning id",
        [org, opp],
      )
    ).rows[0].id;
    async function row(id) {
      return (await db.query('select * from public.pursuit_requirements where id=$1', [id]))
        .rows[0];
    }
    async function make(p = pursuit) {
      return (
        await db.query(
          "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation,owner_user_id) values($1,$2,'Training form','Training notice section 1',$3) returning *",
          [org, p, users.capture_manager],
        )
      ).rows[0];
    }
    const source = await make(),
      target = await make(),
      different = await make(otherPursuit);
    const task = (
      await db.query(
        "insert into public.pursuit_tasks(organization_id,pursuit_id,requirement_id,title) values($1,$2,$3,'Review original evidence') returning id",
        [org, pursuit, source.id],
      )
    ).rows[0].id;
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
      capture = users.capture_manager;
    const change = 'select public.change_requirement_lifecycle($1,$2,$3,$4,$5,$6,$7,$8,$9) id';
    const args = (r, op = 'archive', t = null) => [
      org,
      pursuit,
      r.id,
      r.updated_at,
      op,
      'Synthetic correction reason',
      t?.id ?? null,
      t?.updated_at ?? null,
      t ? 'Combined training form instructions' : null,
    ];
    const context = async () =>
      (await as(admin, 'select public.pursuit_decision_context($1,$2) c', [org, pursuit])).rows[0]
        .c;
    for (const user of [
      users.viewer,
      users.estimator,
      users.executive_approver,
      users.foreign,
      null,
    ])
      await assert.rejects(as(user, change, args(source)));
    await assert.rejects(as(admin, change, args(source, 'merge', source)));
    await assert.rejects(as(admin, change, args(source, 'merge', different)));
    await assert.rejects(as(admin, change, [...args(source).slice(0, 5), '', null, null, null]));
    await assert.rejects(
      as(
        admin,
        "update public.pursuit_requirements set archived_at=now(),archived_by=$1,archive_reason='Bypass' where id=$2",
        [admin, source.id],
      ),
    );
    await assert.rejects(
      as(admin, 'delete from public.pursuit_requirements where id=$1', [source.id]),
    );
    await assert.rejects(
      as(
        admin,
        "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,archived_at,archived_by,archive_reason) values($1,$2,'Bypass',now(),$3,'Bypass')",
        [org, pursuit, admin],
      ),
    );
    await assert.rejects(
      as(admin, 'update public.pursuit_requirements set pursuit_id=$1 where id=$2', [
        otherPursuit,
        source.id,
      ]),
    );

    // An attested evidence link remains on its original row and never becomes target approval.
    const profile = (
      await db.query(
        'insert into public.company_profiles(organization_id) values($1) returning id',
        [org],
      )
    ).rows[0].id;
    const fact = (
      await db.query(
        "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value,source_reference,sensitivity) values($1,$2,'license','Training license','Training only','Training reference','restricted') returning id,updated_at",
        [org, profile],
      )
    ).rows[0];
    await as(
      admin,
      "insert into public.evidence_use_reviews(organization_id,requirement_id,fact_id,fact_version,requirement_version,applicability,proposal_use,reason) values($1,$2,$3,$4,$5,'unknown','not_approved','Training link')",
      [org, source.id, fact.id, fact.updated_at, source.updated_at],
    );
    for (const r of [source, target])
      await as(
        admin,
        "select public.resolve_pursuit_requirement($1,$2,$3,null,'not_applicable','Synthetic optional training form',null,'','')",
        [org, r.id, r.updated_at],
      );
    const oldContext = await context();
    const signoff = (
      await as(
        admin,
        "select public.sign_off_requirements_register($1,$2,$3,'Synthetic review') id",
        [org, pursuit, oldContext],
      )
    ).rows[0].id;
    const pversion = (
      await db.query('select updated_at from public.pursuits where id=$1', [pursuit])
    ).rows[0].updated_at;
    const decision = (
      await as(
        admin,
        "select public.record_pursuit_decision($1,$2,$3,$4,'bid','Synthetic decision','') id",
        [org, pursuit, pversion, oldContext],
      )
    ).rows[0].id;
    const snapshot = (
      await db.query('select review_snapshot from public.pursuit_decision_history where id=$1', [
        decision,
      ])
    ).rows[0].review_snapshot;
    const response = {
      schema: 1,
      context: oldContext,
      summary: 'Synthetic completed training response',
      answers: [source, target].map((r) => ({
        requirementId: r.id,
        requirementVersion: r.updated_at,
        text: 'Optional training form is not applicable per source.',
      })),
    };
    const pack = (
      await db.query(
        "insert into public.proposal_sections(organization_id,pursuit_id,title,content,status) values($1,$2,'Training response',$3,'draft') returning id,updated_at",
        [org, pursuit, JSON.stringify(response)],
      )
    ).rows[0];
    const checklist = {
      ...Object.fromEntries(
        [
          'instructions',
          'attachments',
          'forms',
          'signatures',
          'certifications',
          'amendments',
          'pricing',
          'filenames',
          'formats',
          'limits',
          'source_review',
        ].map((k) => [k, { status: 'confirmed', reference: 'Training review only' }]),
      ),
      method: 'Training portal',
      portal: 'https://example.invalid/submit',
      source_version: 'Training 1',
      reviewed_at: new Date().toISOString(),
      submitter: capture,
      files: [{ name: 'training.pdf', sha256: 'a'.repeat(64), reference: 'Fictional file' }],
    };
    const rc = (await as(admin, 'select public.response_release_context($1,$2) c', [org, pursuit]))
      .rows[0].c;
    const release = (
      await as(capture, 'select public.freeze_response_release($1,$2,$3,$4,$5,$6) id', [
        org,
        pursuit,
        pack.id,
        pack.updated_at,
        rc,
        JSON.stringify(checklist),
      ])
    ).rows[0].id;
    const frozen = (
      await db.query('select snapshot,checksum from public.response_release_versions where id=$1', [
        release,
      ])
    ).rows[0];
    const status = async () =>
      (await as(admin, 'select public.response_release_status($1,$2) s', [org, release])).rows[0].s;
    assert.equal((await status()).current, true);
    for (const gate of ['pricing', 'compliance', 'final', 'submission'])
      await as(
        admin,
        "select public.record_response_approval($1,$2,$3,$4,'approved','Training approval','',null)",
        [org, release, frozen.checksum, gate],
      );
    assert.equal((await status()).state, 'Authorized for submission');
    await as(capture, change, args(source, 'merge', target));
    assert.equal((await status()).current, false);
    assert.equal((await status()).approvals.submission, false);
    assert.deepEqual(
      (
        await db.query('select snapshot from public.response_release_versions where id=$1', [
          release,
        ])
      ).rows[0].snapshot,
      frozen.snapshot,
    );
    const archived = await row(source.id),
      merged = await row(target.id);
    assert(archived.archived_at);
    assert.equal(archived.requirement, source.requirement);
    assert.equal(archived.citation, source.citation);
    assert.equal(archived.merged_into_id, target.id);
    assert.equal(merged.requirement, 'Combined training form instructions');
    assert(merged.citation.includes(source.id));
    assert(merged.citation.startsWith(target.citation));
    assert(merged.citation.endsWith(source.citation));
    assert.equal(merged.status, 'needs_review');
    assert.notEqual(await context(), oldContext);
    assert.deepEqual(
      (
        await db.query('select review_snapshot from public.pursuit_decision_history where id=$1', [
          decision,
        ])
      ).rows[0].review_snapshot,
      snapshot,
    );
    assert.equal(
      (
        await db.query(
          'select context_token from public.requirements_register_signoffs where id=$1',
          [signoff],
        )
      ).rows[0].context_token,
      oldContext,
    );
    await assert.rejects(
      as(admin, "select public.record_pursuit_decision($1,$2,$3,$4,'bid','Stale attempt','')", [
        org,
        pursuit,
        pversion,
        await context(),
      ]),
      /sign-off/,
    );
    assert.equal(
      (await db.query('select requirement_id from public.pursuit_tasks where id=$1', [task]))
        .rows[0].requirement_id,
      source.id,
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from public.evidence_use_reviews where requirement_id=$1',
          [source.id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from public.evidence_use_reviews where requirement_id=$1',
          [target.id],
        )
      ).rows[0].n,
      0,
    );
    await assert.rejects(
      as(
        admin,
        "update public.pursuit_requirements set requirement='Changed archive' where id=$1",
        [source.id],
      ),
      /Restore/,
    );
    await assert.rejects(
      as(
        admin,
        "select public.resolve_pursuit_requirement($1,$2,$3,null,'not_applicable','Archived attempt',null,'','')",
        [org, source.id, archived.updated_at],
      ),
      /Restore/,
    );
    await assert.rejects(as(admin, change, args(source, 'restore')), /changed/);
    const beforeRestore = await context();
    await as(admin, change, args(archived, 'restore'));
    const restored = await row(source.id);
    assert.equal(restored.archived_at, null);
    assert.equal(restored.merged_into_id, null);
    assert.equal(restored.requirement, source.requirement);
    assert.equal(restored.status, 'needs_review');
    assert.equal((await row(target.id)).requirement, merged.requirement);
    assert.notEqual(await context(), beforeRestore);
    await assert.rejects(as(admin, change, args(restored, 'restore')), /already active/);
    await assert.rejects(as(admin, change, args(restored, 'merge', target)), /target changed/);
    await as(admin, change, args(restored));
    assert.equal(
      (await as(users.foreign, 'select * from public.requirement_lifecycle_history')).rows.length,
      0,
    );
    assert.equal(
      (
        await as(
          users.viewer,
          'select * from public.requirement_lifecycle_history where organization_id=$1',
          [org],
        )
      ).rows.length,
      3,
    );
    await assert.rejects(
      as(
        admin,
        "update public.requirement_lifecycle_history set reason='Erase history' where organization_id=$1",
        [org],
      ),
    );
    await assert.rejects(
      db.query(
        "update public.requirement_lifecycle_history set reason='Operator edit' where organization_id=$1",
        [org],
      ),
      /immutable/,
    );
    await assert.rejects(
      as(admin, 'insert into public.requirement_lifecycle_history(organization_id) values($1)', [
        org,
      ]),
    );
    const newContext = await context();
    const newSignoff = (
      await as(
        admin,
        "select public.sign_off_requirements_register($1,$2,$3,'Active-only review') id",
        [org, pursuit, newContext],
      )
    ).rows[0].id;
    assert.equal(
      (
        await db.query(
          'select requirement_count from public.requirements_register_signoffs where id=$1',
          [newSignoff],
        )
      ).rows[0].requirement_count,
      1,
    );
    await as(admin, change, args(await row(target.id)));
    await assert.rejects(
      as(admin, "select public.sign_off_requirements_register($1,$2,$3,'Empty review')", [
        org,
        pursuit,
        await context(),
      ]),
      /nonempty/,
    );
    console.log(
      'PASS archive/restore/merge: scoped roles, stale-write rejection, citations and linked records retained, immutable history, active-only sign-off.',
    );
  } finally {
    if (hosted) await db.query('rollback');
    await db.end();
  }
});
