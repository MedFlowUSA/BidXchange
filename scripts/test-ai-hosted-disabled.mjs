// Hosted RLS checks only. No COMMIT, model calls, schema changes or AI activation.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';

assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'bcrxejydosltquspsutw');
assert(!process.env.BIDXCHANGE_TEST_DATABASE_URL, 'Only the verified linked target is supported');
const db = await connectDatabase();
const orgs = [randomUUID(), randomUUID()];
const users = [randomUUID(), randomUUID(), randomUUID()];
const opportunities = [randomUUID(), randomUUID()];
const usages = [randomUUID(), randomUUID()];
let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  console.log('PASS ' + label);
  checks++;
}
async function asUser(id, role = 'authenticated') {
  await db.query('set local role postgres');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id ?? '']);
  await db.query(`set local role ${role}`);
}
async function denied(sql, args, label) {
  await db.query('savepoint rejected');
  let code;
  try {
    await db.query(sql, args);
  } catch (error) {
    code = error.code;
  }
  await db.query('rollback to savepoint rejected');
  check(code === '42501', label + ' (42501)');
}
try {
  await db.query('begin');
  await db.query("set local statement_timeout='10s'");
  await db.query("set local lock_timeout='3s'");
  check(
    (
      await db.query(
        "select count(*)::int n from supabase_migrations.schema_migrations where version='20260919000500'",
      )
    ).rows[0].n === 1,
    'Migration 005 already installed',
  );
  check(
    (await db.query('select count(*)::int n from public.ai_organization_settings where enabled'))
      .rows[0].n === 0,
    'Production organizations remain disabled',
  );
  for (const user of users)
    await db.query(
      "insert into auth.users(id,email,aud,role) values($1,$2,'authenticated','authenticated')",
      [user, `disabled-ai-${user}@example.invalid`],
    );
  for (let i = 0; i < 2; i++) {
    await db.query(
      "insert into public.organizations(id,legal_name,operating_name,slug) values($1,'Synthetic disabled AI check','Synthetic disabled AI check',$2)",
      [orgs[i], 'disabled-ai-' + orgs[i]],
    );
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin'),($1,$3,'viewer')",
      [orgs[i], users[0], users[i + 1]],
    );
    const profile = randomUUID();
    await db.query('insert into public.company_profiles(id,organization_id) values($1,$2)', [
      profile,
      orgs[i],
    ]);
    await db.query('insert into public.ai_organization_settings(organization_id) values($1)', [
      orgs[i],
    ]);
    // Seed accounting metadata as the fixture operator, never as an asserted user.
    await db.query(
      'insert into public.ai_usage_events(id,organization_id,user_id,prompt_digest) values($1,$2,$3,$4)',
      [usages[i], orgs[i], users[i + 1], 'a'.repeat(64)],
    );
    await db.query(
      "insert into public.opportunities(id,organization_id,title) values($1,$2,'Synthetic private opportunity')",
      [opportunities[i], orgs[i]],
    );
    for (const [sensitivity, type] of [
      ['unknown', 'license'],
      ['workspace', 'license'],
      ['restricted', 'insurance'],
      ['restricted', 'bonding'],
      ['restricted', 'personnel'],
      ['restricted', 'subcontractor'],
      ['restricted', 'pricing'],
      ['restricted', 'private_document'],
      ['workspace', 'pricing'],
    ])
      await db.query(
        'insert into public.profile_facts(id,organization_id,company_profile_id,fact_type,label,value,source_note,sensitivity) values($1,$2,$3,$4,$5,$6,$6,$7)',
        [
          randomUUID(),
          orgs[i],
          profile,
          type,
          'Synthetic ' + sensitivity + ' ' + type,
          'SYNTHETIC-ONLY',
          sensitivity,
        ],
      );
  }
  for (const role of ['viewer', 'contributor']) {
    await asUser(null, 'postgres');
    await db.query(
      'update public.organization_memberships set role=$1 where organization_id=$2 and user_id=$3',
      [role, orgs[0], users[1]],
    );
    await asUser(users[1]);
    const facts = (
      await db.query(
        'select fact_type,sensitivity from public.profile_facts where organization_id=$1',
        [orgs[0]],
      )
    ).rows;
    check(
      facts.length === 1 &&
        facts[0].fact_type === 'license' &&
        facts[0].sensitivity === 'workspace',
      role + ' sees only explicitly safe fact',
    );
    for (const table of ['profile_facts', 'opportunities', 'organizations', 'ai_usage_events'])
      check(
        (
          await db.query(
            `select id from public.${table} where ${table === 'organizations' ? 'id' : 'organization_id'}=$1`,
            [orgs[1]],
          )
        ).rows.length === 0,
        role + ' foreign scope denied: ' + table,
      );
    check(
      (
        await db.query(
          'select organization_id from public.ai_organization_settings where organization_id=$1',
          [orgs[1]],
        )
      ).rows.length === 0,
      role + ' foreign AI settings denied',
    );
    check(
      (await db.query('select id from public.opportunities where id=$1', [opportunities[1]])).rows
        .length === 0,
      role + ' guessed foreign opportunity/citation UUID denied',
    );
    check(
      (await db.query('select id from public.ai_usage_events where id=$1', [usages[0]])).rows
        .length === 1,
      role + ' can read own usage metadata',
    );
    check(
      !(await db.query("select public.ai_feedback($1,$2,'helpful') saved", [orgs[1], usages[1]]))
        .rows[0].saved,
      role + ' foreign feedback denied',
    );
    for (const [org, expected] of [
      [orgs[0], 'unavailable'],
      [orgs[1], 'forbidden'],
    ])
      check(
        (
          await db.query('select public.reserve_ai_request($1,$2,$3,100,20) result', [
            org,
            randomUUID(),
            'b'.repeat(64),
          ])
        ).rows[0].result === expected,
        role + ' reservation ' + expected,
      );
    await denied(
      'select prompt_digest from public.ai_usage_events where organization_id=$1',
      [orgs[0]],
      role + ' cannot read digest',
    );
    await denied(
      'update public.ai_usage_events set organization_id=$1 where id=$2',
      [orgs[1], usages[0]],
      role + ' cannot reassign accounting',
    );
    await denied(
      'update public.ai_organization_settings set daily_org_limit=1000 where organization_id=$1',
      [orgs[0]],
      role + ' cannot raise quota',
    );
  }
  await asUser(null, 'postgres');
  await db.query(
    "update public.organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",
    [orgs[0], users[1]],
  );
  await asUser(users[1]);
  for (const table of ['profile_facts', 'opportunities', 'ai_usage_events'])
    check(
      (await db.query(`select id from public.${table} where organization_id=$1`, [orgs[0]])).rows
        .length === 0,
      'Revocation removes ' + table + ' access',
    );
  check(
    (
      await db.query('select public.reserve_ai_request($1,$2,$3,100,20) result', [
        orgs[0],
        randomUUID(),
        'b'.repeat(64),
      ])
    ).rows[0].result === 'forbidden',
    'Revocation prevents new reservations',
  );
  check(
    !(await db.query("select public.ai_feedback($1,$2,'helpful') saved", [orgs[0], usages[0]]))
      .rows[0].saved,
    'Revocation prevents feedback',
  );
  await asUser(null, 'anon');
  await denied(
    'select public.reserve_ai_request($1,$2,$3,100,20)',
    [orgs[0], randomUUID(), 'b'.repeat(64)],
    'Anonymous reservation denied',
  );
  await denied('select id from public.ai_usage_events', [], 'Anonymous usage denied');
  await asUser(null, 'postgres');
  check(
    (await db.query('select count(*)::int n from public.ai_organization_settings where enabled'))
      .rows[0].n === 0,
    'No organization enabled during validation',
  );
} finally {
  await db.query('rollback');
  const remaining = (
    await db.query('select count(*)::int n from public.organizations where id=any($1::uuid[])', [
      orgs,
    ])
  ).rows[0].n;
  const remainingUsers = (
    await db.query('select count(*)::int n from auth.users where id=any($1::uuid[])', [users])
  ).rows[0].n;
  await db.end();
  check(
    remaining === 0 && remainingUsers === 0,
    'All synthetic identities and organizations rolled back',
  );
}
console.log(
  `Hosted disabled AI checks passed: ${checks}. SQL role/claim testing only; no JWT, provider or concurrent-quota claim.`,
);
