import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { localTestDatabase } from './local-test-db.mjs';
import { stagingDatabase } from './staging/connection.mjs';

test('verified company creation and invitation lifecycle enforce identity, tenancy, roles, limits and audit', async () => {
  const staging = process.env.BIDXCHANGE_ONBOARDING_TEST_STAGING === '1';
  const db = staging
    ? await stagingDatabase()
    : await localTestDatabase({ includeCompanySeed: false });
  if (staging) {
    await db.query('begin');
    const query = db.query.bind(db);
    db.query = async (sql, args) => {
      if (sql === 'rollback') return query(sql, args);
      await query('savepoint onboarding_check');
      try {
        const result = await query(sql, args);
        await query('release savepoint onboarding_check');
        return result;
      } catch (error) {
        await query('rollback to savepoint onboarding_check');
        await query('release savepoint onboarding_check');
        throw error;
      }
    };
  } else
    await db.query(
      readFileSync('supabase/migrations/20260921002700_workspace_onboarding.sql', 'utf8'),
    );
  const admin = randomUUID(),
    recipient = randomUUID(),
    outsider = randomUUID(),
    unconfirmed = randomUUID();
  const email = (id) => `synthetic-${id}@example.invalid`;
  const actor = async (user, sql, args) => {
    await db.query('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    try {
      return await db.query(sql, args);
    } finally {
      await db.query(staging ? 'set role postgres' : 'reset role');
    }
  };
  const create = async (user, request = randomUUID()) =>
    (
      await actor(
        user,
        "select public.create_company_workspace('Synthetic Contractor','Synthetic Contractor',$1) id",
        [request],
      )
    ).rows[0].id;
  const invite = async (user, org, id, role = 'viewer') =>
    (await actor(user, 'select public.invite_company_member($1,$2,$3) id', [org, email(id), role]))
      .rows[0].id;
  const accept = (user, id) => actor(user, 'select public.accept_company_invitation($1) id', [id]);
  try {
    await db.query(
      'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now()),($5,$6,now()),($7,$8,null)',
      [
        admin,
        email(admin),
        recipient,
        email(recipient),
        outsider,
        email(outsider),
        unconfirmed,
        email(unconfirmed),
      ],
    );
    await assert.rejects(create(unconfirmed), /Confirm your email/);
    await assert.rejects(
      actor(admin, "select public.create_company_workspace(' ','Name',$1)", [randomUUID()]),
      /Enter a legal/,
    );
    const request = randomUUID();
    const org = await create(admin, request);
    assert.equal(await create(admin, request), org, 'retry returns same organization');
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from public.company_profiles where organization_id=$1',
          [org],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          'select role from public.organization_memberships where organization_id=$1 and user_id=$2',
          [org, admin],
        )
      ).rows[0].role,
      'organization_admin',
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from public.profile_facts where organization_id=$1',
          [org],
        )
      ).rows[0].n,
      0,
      'no invented evidence',
    );
    await create(admin);
    await create(admin);
    await assert.rejects(create(admin), /three|additional companies/);
    assert.equal(await create(admin, request), org, 'retry still works at limit');
    await assert.rejects(
      actor(
        admin,
        "insert into public.organizations(legal_name,operating_name,slug) values('Bypass','Bypass','bypass')",
      ),
      /permission|policy/,
    );
    await assert.rejects(actor(admin, 'select * from private.workspace_creations'), /permission/);
    await assert.rejects(actor(admin, 'select private.confirmed_account_email()'), /permission/);
    await assert.rejects(invite(outsider, org, recipient), /administrator/);
    const invitation = await invite(admin, org, recipient, 'estimator');
    await assert.rejects(invite(admin, org, recipient, 'organization_admin'), /pending invitation/);
    assert.equal(
      (
        await actor(
          outsider,
          'select * from public.organization_invitations where organization_id=$1',
          [org],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await actor(
          recipient,
          'select * from public.organization_invitations where organization_id=$1',
          [org],
        )
      ).rows.length,
      0,
      'recipient gets limited RPC only',
    );
    assert.equal(
      (await actor(outsider, 'select * from public.my_company_invitations()')).rows.length,
      0,
    );
    assert.equal(
      (await actor(recipient, 'select * from public.my_company_invitations()')).rows[0].id,
      invitation,
    );
    await assert.rejects(accept(outsider, invitation), /unavailable/);
    await assert.rejects(
      actor(
        recipient,
        "update public.organization_invitations set role='organization_admin' where id=$1",
        [invitation],
      ),
      /permission/,
    );
    assert.equal((await accept(recipient, invitation)).rows[0].id, org);
    assert.equal(
      (
        await db.query(
          'select role from public.organization_memberships where organization_id=$1 and user_id=$2',
          [org, recipient],
        )
      ).rows[0].role,
      'estimator',
    );
    await assert.rejects(
      accept(recipient, invitation),
      /unavailable|expired/,
      'cannot replay acceptance',
    );
    await assert.rejects(invite(recipient, org, outsider), /administrator/);
    await assert.rejects(invite(admin, org, recipient), /already has a membership/);
    assert.equal(
      (
        await actor(outsider, 'select * from public.company_profiles where organization_id=$1', [
          org,
        ])
      ).rows.length,
      0,
    );
    const secondOrg = await create(outsider);
    const secondInvite = await invite(outsider, secondOrg, recipient, 'viewer');
    await accept(recipient, secondInvite);
    assert.equal(
      (await actor(recipient, 'select id from public.organizations')).rows.length,
      2,
      'consultant can join separate companies',
    );
    assert.equal(
      (
        await actor(admin, 'select * from public.company_profiles where organization_id=$1', [
          secondOrg,
        ])
      ).rows.length,
      0,
    );
    // Raw JWT email claims cannot replace the email confirmed in auth.users.
    await db.query("select set_config('request.jwt.claim.email',$1,false)", [email(unconfirmed)]);
    const unconfirmedInvite = await invite(admin, org, unconfirmed);
    await assert.rejects(accept(unconfirmed, unconfirmedInvite), /Confirm your email/);
    assert.equal(
      (await actor(unconfirmed, 'select * from public.my_company_invitations()')).rows.length,
      0,
    );
    await db.query('update auth.users set email_confirmed_at=now() where id=$1', [unconfirmed]);
    await db.query(
      "update public.organization_invitations set expires_at=now()-interval '1 minute' where id=$1",
      [unconfirmedInvite],
    );
    await assert.rejects(accept(unconfirmed, unconfirmedInvite), /expired/);
    const fresh = await invite(admin, org, unconfirmed);
    assert.notEqual(fresh, unconfirmedInvite);
    await assert.rejects(
      actor(outsider, 'select public.revoke_company_invitation($1,$2)', [org, fresh]),
      /administrator/,
    );
    assert.equal(
      (await actor(admin, 'select public.revoke_company_invitation($1,$2) ok', [org, fresh]))
        .rows[0].ok,
      true,
    );
    await assert.rejects(accept(unconfirmed, fresh), /revoked|unavailable/);
    const suspended = await invite(admin, org, unconfirmed);
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role,status) values($1,$2,'viewer','suspended')",
      [org, unconfirmed],
    );
    await assert.rejects(accept(unconfirmed, suspended), /restore access/);
    await db.query(
      "update public.organization_memberships set status='active' where organization_id=$1 and user_id=$2",
      [org, unconfirmed],
    );
    await db.query(
      "update public.organization_invitations set role='organization_admin' where id=$1",
      [suspended],
    );
    await accept(unconfirmed, suspended);
    assert.equal(
      (
        await db.query(
          'select role from public.organization_memberships where organization_id=$1 and user_id=$2',
          [org, unconfirmed],
        )
      ).rows[0].role,
      'viewer',
      'existing active membership cannot be elevated by acceptance',
    );
    const fourth = randomUUID();
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      fourth,
      email(fourth),
    ]);
    const blocked = await invite(admin, org, fourth);
    await db.query("update public.organizations set status='suspended' where id=$1", [org]);
    await assert.rejects(accept(fourth, blocked), /unavailable/);
    await db.query("update public.organizations set status='active' where id=$1", [org]);
    await db.query(
      "update public.organization_memberships set role='organization_admin' where organization_id=$1 and user_id=$2",
      [org, unconfirmed],
    );
    await db.query(
      "update public.organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",
      [org, admin],
    );
    await assert.rejects(
      accept(fourth, blocked),
      /unavailable/,
      'inviter must still be administrator',
    );
    const audit = (
      await db.query(
        "select actor_user_id,action,next_record from public.audit_events where organization_id=$1 and entity_table='organization_invitations' order by created_at",
        [org],
      )
    ).rows;
    assert(audit.some((e) => e.actor_user_id === admin && e.action === 'INSERT'));
    assert(
      audit.some(
        (e) =>
          e.actor_user_id === recipient &&
          e.next_record.status === 'accepted' &&
          e.next_record.accepted_by === recipient,
      ),
    );
    assert.equal(
      (await actor(outsider, 'select * from public.audit_events where organization_id=$1', [org]))
        .rows.length,
      0,
    );
    await db.query('set role anon');
    await assert.rejects(db.query('select public.my_company_invitations()'), /permission/);
    await db.query(staging ? 'set role postgres' : 'reset role');
  } finally {
    if (staging) await db.query('rollback');
    await db.end();
  }
});
