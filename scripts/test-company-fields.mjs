import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localTestDatabase } from './local-test-db.mjs';
test('structured facts enforce tenant access, canonical text, validation and re-verification', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  const admin = '70000000-0000-4000-8000-000000000001',
    viewer = '70000000-0000-4000-8000-000000000002',
    foreign = '70000000-0000-4000-8000-000000000003';
  try {
    await db.query(readFileSync('supabase/migrations/20260919000500_ai_readonly.sql', 'utf8'));
    await db.query(
      readFileSync('supabase/migrations/20260921001600_structured_company_profiles.sql', 'utf8'),
    );
    await db.query('insert into auth.users(id) values($1),($2),($3)', [admin, viewer, foreign]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Synthetic','Synthetic','structured-test') returning id",
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
    async function as(user, sql, args) {
      await db.query('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      try {
        return await db.query(sql, args);
      } finally {
        await db.query('reset role');
      }
    }
    const insert =
      "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value,source_reference,sensitivity,structured_kind,structured_fields) values($1,$2,$3,$4,'FORGED SUMMARY','Synthetic source',$5,$6,$7) returning *";
    const args = [
      org,
      profile,
      'identity',
      'Primary email',
      'workspace',
      'business_email',
      JSON.stringify({ email: 'office@example.invalid' }),
    ];
    await assert.rejects(as(viewer, insert, args));
    await assert.rejects(as(foreign, insert, args));
    const fact = (await as(admin, insert, args)).rows[0];
    assert.equal(fact.value, 'Business email address: office@example.invalid');
    assert.equal(
      (await as(viewer, 'select id from public.profile_facts where id=$1', [fact.id])).rows.length,
      1,
    );
    assert.equal(
      (await as(foreign, 'select id from public.profile_facts where id=$1', [fact.id])).rows.length,
      0,
    );
    await as(admin, "update public.profile_facts set verification_status='verified' where id=$1", [
      fact.id,
    ]);
    const changed = (
      await as(
        admin,
        'update public.profile_facts set structured_fields=$2 where id=$1 returning *',
        [fact.id, JSON.stringify({ email: 'new@example.invalid' })],
      )
    ).rows[0];
    assert.equal(changed.verification_status, 'pending_verification');
    assert.equal(changed.verified_by, null);
    assert.equal(changed.value, 'Business email address: new@example.invalid');
    for (const fields of [
      { email: 'invalid' },
      { email: 3 },
      { password: 'not allowed' },
      ['wrong'],
      { email: 'x'.repeat(501) },
    ])
      await assert.rejects(
        as(admin, 'update public.profile_facts set structured_fields=$2 where id=$1', [
          fact.id,
          JSON.stringify(fields),
        ]),
      );
    await assert.rejects(
      as(
        admin,
        'update public.profile_facts set structured_kind=null,structured_fields=null where id=$1',
        [fact.id],
      ),
    );
    const bond = [
      org,
      profile,
      'bonding',
      'Bonding',
      'restricted',
      'bonding',
      JSON.stringify({ single_limit: '100000', currency: 'USD' }),
    ];
    const restricted = (await as(admin, insert, bond)).rows[0];
    assert.equal(
      (await as(viewer, 'select id from public.profile_facts where id=$1', [restricted.id])).rows
        .length,
      0,
    );
    for (const fields of [
      { single_limit: '-1', currency: 'USD' },
      { single_limit: '10' },
      { single_limit: '1e8', currency: 'USD' },
      { assessed: '2026-02-30' },
    ])
      await assert.rejects(
        as(admin, 'update public.profile_facts set structured_fields=$2 where id=$1', [
          restricted.id,
          JSON.stringify(fields),
        ]),
      );
    await as(admin, "update public.profile_facts set verification_status='verified' where id=$1", [
      fact.id,
    ]);
    const effective = (
      await as(
        admin,
        "update public.profile_facts set effective_date='2026-09-22' where id=$1 returning verification_status",
        [fact.id],
      )
    ).rows[0];
    assert.equal(effective.verification_status, 'pending_verification');
  } finally {
    await db.end();
  }
});
