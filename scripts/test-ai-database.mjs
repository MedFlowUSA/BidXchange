import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';
const db = process.argv.includes('--linked')
  ? await connectDatabase()
  : await (await import('./local-test-db.mjs')).localTestDatabase();
let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks++;
  console.log('PASS ' + label);
}
async function asUser(id, role = 'authenticated') {
  await db.query('set local role postgres');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id ?? '']);
  await db.query(`set local role ${role}`);
}
async function denied(sql, args, label) {
  await db.query('savepoint denied');
  let code;
  try {
    await db.query(sql, args);
  } catch (error) {
    code = error.code;
  }
  await db.query('rollback to savepoint denied');
  check(code === '42501', label + ' (SQLSTATE 42501)');
}
try {
  await db.query('begin');
  const applied = await db.query("select to_regclass('public.ai_usage_events') as table_name");
  if (!applied.rows[0].table_name)
    await db.query(readFileSync('supabase/migrations/20260919000500_ai_readonly.sql', 'utf8'));
  const users = Array.from({ length: 4 }, () => randomUUID()),
    orgs = [randomUUID(), randomUUID()],
    profiles = [randomUUID(), randomUUID()];
  for (const u of users)
    await db.query(
      "insert into auth.users(id,email,aud,role) values($1,$2,'authenticated','authenticated')",
      [u, `ai-${u}@example.invalid`],
    );
  for (let i = 0; i < 2; i++) {
    await db.query(
      "insert into public.organizations(id,legal_name,operating_name,slug) values($1,'AI synthetic fixture','AI synthetic fixture',$2)",
      [orgs[i], 'ai-' + orgs[i]],
    );
    await db.query('insert into public.company_profiles(id,organization_id) values($1,$2)', [
      profiles[i],
      orgs[i],
    ]);
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin'),($1,$3,'viewer')",
      [orgs[i], users[i], users[2 + i]],
    );
    await db.query('insert into public.ai_organization_settings(organization_id) values($1)', [
      orgs[i],
    ]);
  }
  const ids = [];
  for (const [sensitivity, type] of [
    ['unknown', 'license'],
    ['workspace', 'license'],
    ['workspace', 'insurance'],
    ['restricted', 'bonding'],
  ]) {
    const id = randomUUID();
    ids.push(id);
    await db.query(
      'insert into public.profile_facts(id,organization_id,company_profile_id,fact_type,label,value,source_note,sensitivity) values($1,$2,$3,$4,$5,$6,$6,$7)',
      [id, orgs[0], profiles[0], type, 'Fixture ' + id, 'SENSITIVE FIXTURE', sensitivity],
    );
  }
  const opportunity = randomUUID();
  await db.query(
    "insert into public.opportunities(id,organization_id,title) values($1,$2,'Fixture opportunity')",
    [opportunity, orgs[0]],
  );
  await asUser(users[2]);
  check(
    (await db.query('select id from public.profile_facts where organization_id=$1', [orgs[0]])).rows
      .length === 1,
    'Viewer sees only explicitly classified nonrestricted fact type',
  );
  check(
    (await db.query('select id from public.profile_facts where id=$1', [ids[0]])).rows.length === 0,
    'Unknown facts and their notes excluded',
  );
  for (const role of ['contributor', 'capture_manager', 'estimator', 'executive_approver']) {
    await asUser(users[0]);
    await db.query(
      'update public.organization_memberships set role=$1 where organization_id=$2 and user_id=$3',
      [role, orgs[0], users[2]],
    );
    await asUser(users[2]);
    check(
      (await db.query('select id from public.profile_facts where organization_id=$1', [orgs[0]]))
        .rows.length === (['estimator', 'executive_approver'].includes(role) ? 4 : 1),
      role + ' fact RLS follows sensitivity policy',
    );
  }
  await asUser(users[0]);
  await db.query(
    "update public.organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",
    [orgs[0], users[2]],
  );
  await asUser(users[3]);
  for (const table of [
    'profile_facts',
    'opportunities',
    'ai_organization_settings',
    'ai_usage_events',
  ]) {
    const select = table === 'ai_usage_events' ? 'id' : '*';
    check(
      (await db.query(`select ${select} from public.${table} where organization_id=$1`, [orgs[0]]))
        .rows.length === 0,
      'Foreign tenant cannot read ' + table,
    );
  }
  check(
    (await db.query('select id from public.opportunities where id=$1', [opportunity])).rows
      .length === 0,
    'Foreign opportunity UUID cannot bypass RLS',
  );
  const reserve = async (
    org,
    userLimit = 20,
    orgLimit = 100,
    requestId = randomUUID(),
    digest = randomUUID().replaceAll('-', '').repeat(2),
  ) =>
    (
      await db.query('select public.reserve_ai_request($1,$2,$3,$4,$5) result', [
        org,
        requestId,
        digest,
        orgLimit,
        userLimit,
      ])
    ).rows[0].result;
  check((await reserve(orgs[0])) === 'forbidden', 'Foreign request reservation denied');
  await asUser(users[2]);
  check((await reserve(orgs[0])) === 'unavailable', 'Organization activation defaults disabled');
  await denied(
    'update public.ai_organization_settings set enabled=true where organization_id=$1',
    [orgs[0]],
    'Browser cannot activate AI',
  );
  await asUser(null, 'postgres');
  await db.query(
    'update public.ai_organization_settings set enabled=true,daily_org_limit=2,daily_user_limit=2 where organization_id=$1',
    [orgs[0]],
  );
  await asUser(users[2]);
  const requestId = randomUUID(),
    digest = 'a'.repeat(64);
  check(
    (await reserve(orgs[0], 20, 100, requestId, digest)) === 'reserved',
    'Authorized request atomically reserves usage',
  );
  check(
    (await reserve(orgs[0], 20, 100, requestId, digest)) === 'duplicate',
    'Duplicate UUID blocked',
  );
  check(
    (await reserve(orgs[0], 20, 100, randomUUID(), digest)) === 'duplicate',
    'Duplicate digest blocked',
  );
  check((await reserve(orgs[0])) === 'reserved', 'Second reservation succeeds');
  check(
    (await reserve(orgs[0], 100, 1000)) === 'rate_limited',
    'DB ceiling cannot be raised by client parameters',
  );
  check(
    (await db.query('select id from public.ai_usage_events where organization_id=$1', [orgs[0]]))
      .rows.length === 2,
    'Owner sees own usage metadata',
  );
  await denied(
    'select prompt_digest from public.ai_usage_events',
    [],
    'Prompt digest never exposed',
  );
  await denied(
    'update public.ai_usage_events set created_at=now()',
    [],
    'Browser cannot rewrite accounting',
  );
  await denied('delete from public.ai_usage_events', [], 'Browser cannot refund reservations');
  await denied(
    'insert into public.ai_usage_events(id,organization_id,user_id,prompt_digest) values($1,$2,$3,$4)',
    [randomUUID(), orgs[0], users[2], digest],
    'Browser cannot forge direct usage records',
  );
  check(
    (await db.query("select public.ai_feedback($1,$2,'helpful') saved", [orgs[0], requestId]))
      .rows[0].saved,
    'Own request feedback saved',
  );
  check(
    !(await db.query("select public.ai_feedback($1,$2,'unhelpful') saved", [orgs[0], requestId]))
      .rows[0].saved,
    'Repeated feedback rejected',
  );
  await asUser(users[0]);
  check(
    (await db.query('select id from public.ai_usage_events where organization_id=$1', [orgs[0]]))
      .rows.length === 2,
    'Administrator can inspect usage metadata without prompts',
  );
  check(
    (
      await db.query(
        "select id from public.audit_events where entity_id=$1 and action='AI_REQUEST_RESERVED'",
        [requestId],
      )
    ).rows.length === 1,
    'Request audit event recorded',
  );
  await db.query(
    "update public.organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",
    [orgs[0], users[2]],
  );
  await asUser(users[2]);
  check((await reserve(orgs[0])) === 'forbidden', 'Inactive membership cannot reserve');
  check(
    (await db.query('select id from public.ai_usage_events where organization_id=$1', [orgs[0]]))
      .rows.length === 0,
    'Revoked membership loses usage access',
  );
  await asUser(null, 'anon');
  await denied(
    'select public.reserve_ai_request($1,$2,$3,100,20)',
    [orgs[0], randomUUID(), digest],
    'Anonymous reservation denied',
  );
  await denied('select id from public.ai_usage_events', [], 'Anonymous usage reads denied');
  await asUser(null, 'postgres');
  check(
    (
      await db.query(
        "select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('ai_usage_events','ai_organization_settings') and c.relrowsecurity",
      )
    ).rows[0].n === 2,
    'All new public tables have RLS',
  );
  check(
    (await db.query("select public from storage.buckets where id='company-private'")).rows[0]
      .public === false,
    'Private document bucket stays closed',
  );
  console.log(
    `AI database suite passed: ${checks} checks. Migration and all synthetic fixtures rolled back.`,
  );
} finally {
  await db.query('rollback');
  await db.end();
}
