import test from 'node:test';
import assert from 'node:assert/strict';
import { localTestDatabase } from './local-test-db.mjs';
import { validateMigrations } from './staging/prepare.mjs';
import { stagingDatabase } from './staging/connection.mjs';
import pg from 'pg';
test('release workflow: role matrix, tenant isolation, exact versions, approval dependencies, immutable submission and follow-up', async () => {
  const staging = process.env.BIDXCHANGE_RELEASE_TEST_STAGING === '1';
  if (staging) pg.types.setTypeParser(1184, (value) => value);
  const db = staging
    ? await stagingDatabase()
    : await localTestDatabase({ includeCompanySeed: false });
  if (staging) await db.query('begin');
  if (staging) {
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
  const users = Object.fromEntries(
    [
      'organization_admin',
      'executive_approver',
      'capture_manager',
      'estimator',
      'contributor',
      'viewer',
      'inactive',
      'foreign',
    ].map((r, i) => [r, `a0000000-0000-4000-8000-00000000000${i + 1}`]),
  );
  const admin = users.organization_admin,
    executive = users.executive_approver,
    capture = users.capture_manager;
  try {
    if (!staging) await db.query('create role service_role');
    for (const m of (staging ? [] : validateMigrations('supabase/migrations')).filter(
      (m) =>
        m.file > '20260919000499' &&
        !(process.env.BIDXCHANGE_TEST_WITHOUT_OPTIONAL === '1' && /^20260920001[234]/.test(m.file)),
    ))
      await db.query(m.sql);
    for (const id of Object.values(users))
      await db.query('insert into auth.users(id) values($1)', [id]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Synthetic release','Synthetic release','release-test') returning id",
      )
    ).rows[0].id;
    const other = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Other','Other','other-release-test') returning id",
      )
    ).rows[0].id;
    for (const [role, user] of Object.entries(users))
      await db.query(
        'insert into public.organization_memberships(organization_id,user_id,role,status) values($1,$2,$3,$4)',
        [
          role === 'foreign' ? other : org,
          user,
          ['inactive', 'foreign'].includes(role) ? 'organization_admin' : role,
          role === 'inactive' ? 'suspended' : 'active',
        ],
      );
    const opp = (
      await db.query(
        "insert into public.opportunities(organization_id,title,solicitation_number,source_url,official_deadline,deadline_timezone) values($1,'Synthetic notice','TEST-001','https://example.com/notice',now()+interval '10 days','America/Los_Angeles') returning id",
        [org],
      )
    ).rows[0].id;
    const pursuit = (
      await db.query(
        "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Synthetic pursuit') returning id",
        [org, opp],
      )
    ).rows[0].id;
    const req = (
      await db.query(
        "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation,owner_user_id) values($1,$2,'Synthetic optional form','Section 1',$3) returning id,updated_at",
        [org, pursuit, capture],
      )
    ).rows[0];
    async function as(user, sql, args) {
      await db.query(user ? 'set role authenticated' : 'set role anon');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
      try {
        return await db.query(sql, args);
      } finally {
        await db.query(staging ? 'set role postgres' : 'reset role');
      }
    }
    await as(
      executive,
      "select public.resolve_pursuit_requirement($1,$2,$3,null,'waived','Synthetic documented waiver',null,'Synthetic officer','Training amendment 1')",
      [org, req.id, req.updated_at],
    );
    const bid = async () => {
      const version = (
        await db.query('select updated_at from public.pursuits where id=$1', [pursuit])
      ).rows[0].updated_at;
      const context = (
        await as(admin, 'select public.pursuit_decision_context($1,$2) token', [org, pursuit])
      ).rows[0].token;
      if (!staging || process.env.BIDXCHANGE_CONTRACTOR_TEST_STAGING === '1')
        await as(admin, 'select public.sign_off_requirements_register($1,$2,$3,$4)', [
          org,
          pursuit,
          context,
          'Synthetic register review',
        ]);
      await as(
        admin,
        "select public.record_pursuit_decision($1,$2,$3,$4,'bid','Synthetic decision','')",
        [org, pursuit, version, context],
      );
    };
    await bid();
    const content = {
      schema: 1,
      kind: 'BID',
      context: (
        await as(admin, 'select public.pursuit_decision_context($1,$2) token', [org, pursuit])
      ).rows[0].token,
      summary: 'Reviewed synthetic response.',
      answers: [
        {
          requirementId: req.id,
          requirementVersion:
            typeof req.updated_at === 'string'
              ? req.updated_at.replace(' ', 'T').replace(/\+00$/, '+00:00')
              : new Date(req.updated_at).toISOString(),
          text: 'The optional form is waived by the cited training amendment.',
        },
      ],
    };
    const pack = (
      await db.query(
        "insert into public.proposal_sections(organization_id,pursuit_id,title,content,status) values($1,$2,'BID response: Synthetic',$3,'draft') returning id,updated_at",
        [org, pursuit, JSON.stringify(content)],
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
        ].map((k) => [
          k,
          { status: 'confirmed', reference: 'Synthetic training review, section 1' },
        ]),
      ),
      method: 'Training portal',
      portal: 'https://example.com/training',
      source_version: 'Synthetic amendment 1',
      reviewed_at: new Date().toISOString(),
      submitter: capture,
      files: [
        {
          name: 'synthetic-final.pdf',
          sha256: 'a'.repeat(64),
          reference: 'Synthetic file vault / final',
        },
      ],
    };
    const context = async () =>
      (await as(admin, 'select public.response_release_context($1,$2) token', [org, pursuit]))
        .rows[0].token;
    const freezeSql = 'select public.freeze_response_release($1,$2,$3,$4,$5,$6) id';
    const freezeArgs = async (c = checklist) => [
      org,
      pursuit,
      pack.id,
      (await db.query('select updated_at from public.proposal_sections where id=$1', [pack.id]))
        .rows[0].updated_at,
      await context(),
      JSON.stringify(c),
    ];
    for (const role of [
      'executive_approver',
      'estimator',
      'contributor',
      'viewer',
      'inactive',
      'foreign',
    ])
      await assert.rejects(as(users[role], freezeSql, await freezeArgs()), /Capture access/);
    await assert.rejects(as(null, freezeSql, await freezeArgs()), /permission denied/);
    await assert.rejects(
      as(
        capture,
        freezeSql,
        await freezeArgs({ ...checklist, password: 'must reject extra fields' }),
      ),
      /Unsupported checklist/,
    );
    await assert.rejects(as(capture, freezeSql, [other, ...(await freezeArgs()).slice(1)]));
    const freeze = async (c = checklist) =>
      (await as(capture, freezeSql, await freezeArgs(c))).rows[0].id;
    const release = await freeze();
    const staleVersion = await freezeArgs();
    staleVersion[3] = '2000-01-01T00:00:00Z';
    await assert.rejects(as(capture, freezeSql, staleVersion), /changed or unavailable/);
    const staleContext = await freezeArgs();
    staleContext[4] = 'f'.repeat(64);
    await assert.rejects(as(capture, freezeSql, staleContext), /context changed/);
    await assert.rejects(
      as(admin, 'select public.record_response_approval($1,$2,$3,$4,$5,$6,$7,$8)', [
        org,
        release,
        '0'.repeat(64),
        'pricing',
        'approved',
        'Forged checksum',
        '',
        null,
      ]),
      /version unavailable/,
    );
    assert.equal(await freeze(), release, 'Identical snapshot is idempotent');
    const row = (await as(users.viewer, 'select * from public.response_release_versions')).rows[0];
    assert.equal(row.id, release);
    assert.equal(row.checksum.length, 64);
    for (const role of ['inactive', 'foreign'])
      assert.equal(
        (await as(users[role], 'select * from public.response_release_versions')).rows.length,
        0,
      );
    await assert.rejects(
      as(null, 'select * from public.response_release_versions'),
      /permission denied/,
    );
    const status = async (id = release) =>
      (await as(admin, 'select public.response_release_status($1,$2) s', [org, id])).rows[0].s;
    assert.deepEqual((await status()).blockers, []);
    assert.equal((await status()).state, 'Ready for internal review');
    const approve = async (user, gate, outcome = 'approved', id = release) => {
      const r = (
        await db.query('select checksum from public.response_release_versions where id=$1', [id])
      ).rows[0];
      const old =
        (
          await db.query(
            'select id from public.response_approval_history where release_id=$1 and approval_type=$2 order by sequence desc limit 1',
            [id, gate],
          )
        ).rows[0]?.id ?? null;
      return as(user, 'select public.record_response_approval($1,$2,$3,$4,$5,$6,$7,$8) id', [
        org,
        id,
        r.checksum,
        gate,
        outcome,
        'Synthetic human decision',
        '',
        old,
      ]);
    };
    for (const role of ['capture_manager', 'contributor', 'viewer', 'inactive', 'foreign'])
      await assert.rejects(approve(users[role], 'pricing'), /Authorized approver/);
    await assert.rejects(approve(users.estimator, 'compliance'), /Authorized approver/);
    await assert.rejects(approve(admin, 'final'), /Pricing and compliance/);
    await approve(users.estimator, 'pricing');
    await approve(executive, 'compliance');
    assert.equal((await status()).state, 'Ready for final approval');
    await approve(admin, 'final');
    await approve(executive, 'submission');
    assert.equal((await status()).state, 'Authorized for submission');
    await approve(users.estimator, 'pricing', 'revoked');
    assert.equal((await status()).approvals.final, false);
    assert.equal((await status()).approvals.submission, false);
    await approve(users.estimator, 'pricing');
    assert.equal(
      (await status()).approvals.final,
      false,
      'Reapproval cannot resurrect downstream decisions',
    );
    await approve(admin, 'final');
    await approve(executive, 'submission');
    const details = {
      kind: 'initial',
      method: 'Training portal',
      portal: 'https://example.com/training',
      submitted_at: new Date().toISOString(),
      confirmation: 'SYNTHETIC-RECEIPT',
      receipt: 'Training receipt reference',
      receipt_limitation: '',
      notes: 'Synthetic test, no actual buyer submission.',
      followup_at: '',
    };
    const submit = (user, d = details, previous = null, confirmed = true) =>
      as(user, 'select public.record_response_submission($1,$2,$3,$4,$5,$6) id', [
        org,
        release,
        row.checksum,
        JSON.stringify(d),
        previous,
        confirmed,
      ]);
    await assert.rejects(submit(capture, details, null, false), /Confirm/);
    await assert.rejects(submit(admin), /named authorized submitter/);
    for (const role of ['estimator', 'contributor', 'viewer', 'inactive', 'foreign'])
      await assert.rejects(submit(users[role]));
    await assert.rejects(
      submit(capture, { ...details, receipt: '', receipt_limitation: '' }),
      /receipt/,
    );
    await assert.rejects(
      submit(capture, { ...details, portal_password: 'reject' }),
      /Unsupported submission/,
    );
    const submitted = (await submit(capture)).rows[0].id;
    assert.equal((await status()).state, 'Submitted');
    await assert.rejects(submit(capture), /history changed/);
    const correction = (
      await submit(
        capture,
        { ...details, kind: 'correction', notes: 'Corrected receipt reference' },
        submitted,
      )
    ).rows[0].id;
    assert.notEqual(correction, submitted);
    assert.equal(
      (await as(users.viewer, 'select * from public.response_submission_history')).rows.length,
      2,
    );
    await as(
      capture,
      "select public.record_response_followup($1,$2,'debrief_requested','Synthetic debrief request',null)",
      [org, release],
    );
    await assert.rejects(
      as(users.viewer, "select public.record_response_followup($1,$2,'award','Forged',null)", [
        org,
        release,
      ]),
      /Capture or executive/,
    );
    for (const table of [
      'response_release_versions',
      'response_approval_history',
      'response_submission_history',
      'response_followup_history',
    ]) {
      await assert.rejects(as(admin, `delete from public.${table}`), /permission denied/);
      await assert.rejects(
        as(admin, `insert into public.${table}(id) values(gen_random_uuid())`),
        /permission denied/,
      );
      await assert.rejects(db.query(`delete from public.${table}`), /immutable/);
      await assert.rejects(
        db.query(`update public.${table} set organization_id=organization_id`),
        /immutable/,
      );
      assert.equal((await as(users.foreign, `select * from public.${table}`)).rows.length, 0);
    }
    await db.query(
      "update public.proposal_sections set content=jsonb_set(content::jsonb,'{summary}','\"Changed response\"')::text where id=$1",
      [pack.id],
    );
    assert.equal((await status()).current, false);
    await assert.rejects(approve(admin, 'final'), /blockers/);
    const newRelease = await freeze();
    assert.notEqual(newRelease, release);
    assert.equal((await status(newRelease)).approvals.submission, false);
    await db.query("update public.opportunities set source_note='New amendment' where id=$1", [
      opp,
    ]);
    assert.equal((await status(newRelease)).current, false);
    await bid();
    const unknown = await freeze({
      ...checklist,
      signatures: { status: 'unknown', reference: '' },
    });
    assert((await status(unknown)).blockers.some((x) => x.includes('signatures')));
    await assert.rejects(approve(admin, 'pricing', 'approved', unknown), /blockers/);
    const current = await freeze();
    await db.query(
      "update public.organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",
      [org, executive],
    );
    assert.equal((await status(current)).current, false);
    assert(
      (
        await db.query(
          "select count(*)::int n from public.audit_events where entity_table like 'response_%'",
          [],
        )
      ).rows[0].n >= 15,
    );
  } finally {
    if (staging) await db.query('rollback');
    await db.end();
  }
});
