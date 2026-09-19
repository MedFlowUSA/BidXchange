import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { connectDatabase } from './db.mjs';

const db = await connectDatabase();
let checks = 0;
const check = (condition, description) => {
  assert.ok(condition, description);
  checks++;
  console.log(`PASS ${description}`);
};
async function denied(query, args, description) {
  await db.query('savepoint attempt');
  let failed = false;
  try {
    await db.query(query, args);
  } catch {
    failed = true;
  }
  await db.query('rollback to savepoint attempt');
  check(failed, description);
}
async function asUser(id, role = 'authenticated') {
  await db.query('set local role postgres');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id ?? '']);
  await db.query(`set local role ${role}`);
}
const seed = readFileSync('supabase/migrations/20260919000200_ges_onboarding.sql', 'utf8');
try {
  await db.query('begin');
  if (process.argv.includes('--rehearse'))
    await db.query(
      readFileSync('supabase/migrations/20260919000100_tenant_foundation.sql', 'utf8'),
    );
  await db.query(seed);
  const ges = (
    await db.query("select id from public.organizations where slug='green-energy-solutions'")
  ).rows[0].id;
  const first = (
    await db.query('select count(*)::int n from public.profile_facts where organization_id=$1', [
      ges,
    ])
  ).rows[0].n;
  await db.query(seed);
  check(
    (
      await db.query('select count(*)::int n from public.profile_facts where organization_id=$1', [
        ges,
      ])
    ).rows[0].n === first && first === 31,
    'GES seed is idempotent with 31 facts',
  );
  check(
    (
      await db.query(
        "select count(*)::int n from public.profile_facts where organization_id=$1 and verification_status<>'pending_verification'",
        [ges],
      )
    ).rows[0].n === 0,
    'GES facts remain pending verification',
  );
  check(
    (
      await db.query(
        'select count(*)::int n from public.onboarding_items where organization_id=$1',
        [ges],
      )
    ).rows[0].n === 27,
    '27 unknown fields are onboarding tasks',
  );
  check(
    (await db.query('select * from public.company_profiles where organization_id=$1', [ges]))
      .rows[0].minimum_project_value === null,
    'Unknown project limits remain null',
  );
  for (const table of [
    'opportunities',
    'pursuits',
    'past_performance',
    'insurance_records',
    'bonding_records',
    'key_personnel',
    'certifications',
  ])
    check(
      (
        await db.query(`select count(*)::int n from public.${table} where organization_id=$1`, [
          ges,
        ])
      ).rows[0].n === 0,
      `No fictional ${table} in GES`,
    );
  const users = Array.from({ length: 4 }, () => randomUUID());
  for (const id of users)
    await db.query(
      "insert into auth.users(id,email,aud,role) values($1,$2,'authenticated','authenticated')",
      [id, `rls-${id}@example.invalid`],
    );
  const orgs = [];
  const profiles = [];
  const facts = [];
  for (let i = 0; i < 2; i++) {
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Fictional security fixture','Fictional security fixture',$1) returning id",
        [`fixture-${randomUUID()}`],
      )
    ).rows[0].id;
    orgs.push(org);
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin')",
      [org, users[i]],
    );
    const profile = (
      await db.query(
        'insert into public.company_profiles(organization_id) values($1) returning id',
        [org],
      )
    ).rows[0].id;
    profiles.push(profile);
    const fact = (
      await db.query(
        "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value) values($1,$2,'test','Test fact','Fictional') returning id",
        [org, profile],
      )
    ).rows[0].id;
    facts.push(fact);
  }
  await db.query(
    "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'contributor'),($1,$3,'viewer')",
    [orgs[0], users[2], users[3]],
  );
  const schemas = (
    await db.query(
      "select table_name,column_name,is_nullable,column_default,data_type from information_schema.columns where table_schema='public' order by ordinal_position",
    )
  ).rows;
  const tables = [
    ...new Set(schemas.filter((c) => c.column_name === 'organization_id').map((c) => c.table_name)),
  ]
    .filter(
      (t) =>
        !['audit_events', 'organization_memberships', 'company_profiles', 'profile_facts'].includes(
          t,
        ),
    )
    .sort(
      (a, b) =>
        (a === 'opportunities' ? 0 : a === 'pursuits' ? 1 : 2) -
        (b === 'opportunities' ? 0 : b === 'pursuits' ? 1 : 2),
    );
  const rows = {};
  for (const table of tables) {
    rows[table] = [];
    for (let i = 0; i < 2; i++) {
      const data = { organization_id: orgs[i] };
      for (const c of schemas.filter(
        (c) =>
          c.table_name === table &&
          c.is_nullable === 'NO' &&
          c.column_default === null &&
          c.column_name !== 'organization_id',
      )) {
        data[c.column_name] =
          c.column_name === 'fact_id'
            ? facts[i]
            : c.column_name === 'opportunity_id'
              ? rows.opportunities[i]
              : c.column_name === 'pursuit_id'
                ? rows.pursuits[i]
                : c.column_name === 'code'
                  ? '999999'
                  : `Fictional ${c.column_name}`;
      }
      const columns = Object.keys(data);
      rows[table].push(
        (
          await db.query(
            `insert into public.${table}(${columns.join(',')}) values(${columns.map((_, j) => '$' + (j + 1)).join(',')}) returning id`,
            Object.values(data),
          )
        ).rows[0].id,
      );
    }
  }
  for (let i = 0; i < 2; i++) {
    await asUser(users[i]);
    check(
      (await db.query('select id from public.organizations')).rows.length === 1,
      `User ${i + 1} reads only own organization`,
    );
    for (const table of [
      'company_profiles',
      'profile_facts',
      'organization_memberships',
      ...tables,
    ]) {
      check(
        (await db.query(`select id from public.${table} where organization_id=$1`, [orgs[i]])).rows
          .length > 0,
        `User ${i + 1} reads own ${table}`,
      );
      check(
        (await db.query(`select id from public.${table} where organization_id=$1`, [orgs[1 - i]]))
          .rows.length === 0,
        `Cross-tenant ${table} read denied`,
      );
      check(
        (
          await db.query(`update public.${table} set updated_at=now() where organization_id=$1`, [
            orgs[1 - i],
          ])
        ).rowCount === 0,
        `Cross-tenant ${table} update denied`,
      );
      check(
        (await db.query(`delete from public.${table} where organization_id=$1`, [orgs[1 - i]]))
          .rowCount === 0,
        `Cross-tenant ${table} delete denied`,
      );
    }
    await denied(
      'insert into public.company_profiles(organization_id) values($1)',
      [orgs[1 - i]],
      'Cross-tenant insert denied',
    );
    await denied(
      "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label) values($1,$2,'test','Bad reference')",
      [orgs[i], profiles[1 - i]],
      'Cross-tenant parent reference denied',
    );
    await denied(
      'update public.profile_facts set organization_id=$1 where id=$2',
      [orgs[1 - i], facts[i]],
      'Tenant reassignment denied',
    );
    await denied(
      'delete from public.audit_events where organization_id=$1',
      [orgs[i]],
      'Audit deletion denied',
    );
    await denied(
      "update public.organization_memberships set role='viewer' where user_id=$1",
      [users[i]],
      'Last administrator demotion denied',
    );
  }
  await asUser(users[2]);
  check(
    (
      await db.query(
        "update public.organization_memberships set role='organization_admin' where user_id=$1",
        [users[2]],
      )
    ).rowCount === 0,
    'Contributor cannot promote themselves',
  );
  await denied(
    "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin')",
    [orgs[1], users[2]],
    'Contributor cannot claim another organization',
  );
  check(
    (
      await db.query(
        "update public.profile_facts set verification_status='verified',source_reference='fake' where id=$1",
        [facts[0]],
      )
    ).rowCount === 0,
    'Contributor cannot verify facts',
  );
  check(
    (await db.query('select id from public.insurance_records')).rows.length === 0,
    'Sensitive insurance restricted from contributor',
  );
  await asUser(users[3]);
  check(
    (
      await db.query(
        "update public.opportunities set title='Unauthorized' where organization_id=$1",
        [orgs[0]],
      )
    ).rowCount === 0,
    'Viewer cannot edit opportunities',
  );
  await asUser(users[0]);
  await db.query(
    "update public.profile_facts set source_reference='Human supplied evidence' where id=$1",
    [facts[0]],
  );
  await db.query("update public.profile_facts set verification_status='verified' where id=$1", [
    facts[0],
  ]);
  check(
    (await db.query('select verified_by from public.profile_facts where id=$1', [facts[0]])).rows[0]
      .verified_by === users[0],
    'Human verification stamps actual authorized actor',
  );
  await db.query("update public.profile_facts set value='Changed fact' where id=$1", [facts[0]]);
  check(
    (await db.query('select verification_status from public.profile_facts where id=$1', [facts[0]]))
      .rows[0].verification_status === 'pending_verification',
    'Changed fact loses verified status',
  );
  check(
    (
      await db.query("select id from public.audit_events where entity_id=$1 and action='UPDATE'", [
        facts[0],
      ])
    ).rows.length >= 3,
    'Fact history captured in immutable audit',
  );
  await asUser(null, 'anon');
  await denied(
    'select * from public.organizations',
    [],
    'Unauthenticated organization access denied',
  );
  await denied('select * from public.profile_facts', [], 'Unauthenticated facts access denied');
  await db.query('set local role postgres');
  const unprotected = (
    await db.query(
      "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    )
  ).rows;
  check(unprotected.length === 0, 'RLS enabled on all public tables');
  check(
    (await db.query("select public from storage.buckets where id='company-private'")).rows[0]
      .public === false,
    'Company bucket is private',
  );
  console.log(`Database suite passed: ${checks} checks. Rolling back all fixtures.`);
} finally {
  await db.query('rollback');
  await db.end();
}
