// Real staging JWTs; operator access is restricted to setup, inspection and cleanup.
// No provider key, provider requests, traces, session files or production writes.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { chromium, expect } from '@playwright/test';
import { stagingDatabase, stagingKeys, stagingRef } from './connection.mjs';
import { cleanupFixtures } from './cleanup.mjs';

const base = 'https://bidxchange-staging.vercel.app';
const mock = process.argv.includes('--mock');
const url = `https://${stagingRef}.supabase.co`;
const keys = stagingKeys();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const operator = createClient(url, keys.service, options);
const anonymous = createClient(url, keys.anon, options);
const db = await stagingDatabase();
const manifest = {
  run: randomUUID(),
  project: stagingRef,
  users: [],
  organizations: [],
  cleaned: false,
};
const report = { project: stagingRef, app: base, checks: [], cleaned: false, providerCalls: 0 };
const save = () => {
  const text = JSON.stringify(manifest, null, 2);
  writeFileSync(`.tmp/staging-fixtures-${manifest.run}.json`, text);
  writeFileSync('.tmp/staging-fixtures.json', text);
};
const check = (ok, label) => {
  assert.ok(ok, label);
  report.checks.push(label);
  console.log('PASS ' + label);
};
let browser;
function required(result, label) {
  if (result.error) throw new Error(label);
  return result.data;
}
async function organization(label, orgLimit = 100, userLimit = 20) {
  const id = randomUUID();
  manifest.organizations.push(id);
  save();
  await db.query(
    "insert into public.organizations(id,legal_name,operating_name,slug,status) values($1,'Synthetic Staging Only',$2,$3,'active')",
    [id, label, `staging-test-${id}`],
  );
  await db.query(
    'insert into public.ai_organization_settings(organization_id,enabled,daily_org_limit,daily_user_limit) values($1,true,$2,$3)',
    [id, orgLimit, userLimit],
  );
  return id;
}
async function member(role, orgs) {
  const email = `staging-${randomUUID()}@example.invalid`,
    password = randomBytes(24).toString('base64url');
  const created = required(
    await operator.auth.admin.createUser({ email, password, email_confirm: true }),
    'Synthetic user creation failed',
  );
  const id = created.user.id;
  manifest.users.push(id);
  save();
  for (const org of orgs)
    await db.query(
      'insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,$3)',
      [org, id, role],
    );
  const cookies = new Map();
  const client = createServerClient(url, keys.anon, {
    cookieOptions: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => [...cookies.values()],
      setAll: (values) => values.forEach((c) => cookies.set(c.name, c)),
    },
  });
  required(
    await client.auth.signInWithPassword({ email, password }),
    'Real staging JWT sign-in failed',
  );
  return { id, role, client, cookies };
}
async function reserve(user, org, overrides = {}) {
  return required(
    await user.client.rpc('reserve_ai_request', {
      org,
      request_id: randomUUID(),
      digest: randomBytes(32).toString('hex'),
      org_limit: 100,
      user_limit: 20,
      ...overrides,
    }),
    'Reservation RPC failed',
  );
}
async function seed(org) {
  const profile = (
    await db.query('insert into public.company_profiles(organization_id) values($1) returning id', [
      org,
    ])
  ).rows[0].id;
  const facts = {};
  for (const sensitivity of ['workspace', 'restricted', 'unknown']) {
    facts[sensitivity] = (
      await db.query(
        "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value,sensitivity,source_note,notes) values($1,$2,'license',$3,$4,$5,'PRIVATE_SOURCE_SENTINEL','PRIVATE_NOTES_SENTINEL') returning id",
        [
          org,
          profile,
          `Synthetic ${sensitivity}`,
          `SYNTHETIC_${sensitivity.toUpperCase()}`,
          sensitivity,
        ],
      )
    ).rows[0].id;
  }
  const opp = (
    await db.query(
      "insert into public.opportunities(organization_id,title,buyer,source_note) values($1,'Synthetic opportunity','Synthetic buyer','Synthetic source') returning id",
      [org],
    )
  ).rows[0].id;
  for (const [table, column] of [
    ['insurance_records', 'carrier'],
    ['bonding_records', 'surety'],
    ['key_personnel', 'full_name'],
    ['approved_subcontractors', 'legal_name'],
  ]) {
    await db.query(
      `insert into public.${table}(organization_id,fact_id,${column}) values($1,$2,'RESTRICTED_SYNTHETIC')`,
      [org, facts.restricted],
    );
  }
  await db.query(
    "insert into public.company_documents(organization_id,title,document_type,storage_path) values($1,'PRIVATE_DOCUMENT_SENTINEL','synthetic','synthetic/private.txt')",
    [org],
  );
  return { facts, opp };
}
async function cleanup() {
  report.cleanup = await cleanupFixtures(db, operator, manifest);
  report.cleaned = manifest.cleaned;
  save();
  if (manifest.quarantined.length)
    writeFileSync(
      '.tmp/staging-quarantine-' + manifest.organizations[0] + '.json',
      JSON.stringify(manifest, null, 2),
    );
}

try {
  // CLI authorizes only deployment protection. Application authorization still uses real user JWTs.
  const raw = execFileSync(
    'cmd.exe',
    [
      '/d',
      '/s',
      '/c',
      `npx --yes vercel curl / --deployment ${base} -- --silent --dump-header - --header x-vercel-set-bypass-cookie:true`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const bypass = raw.match(/^set-cookie: _vercel_jwt=([^;\r\n]+)/im)?.[1];
  assert(bypass, 'Vercel authenticated test access unavailable');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const contextFor = async (user) => {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: '_vercel_jwt',
        value: bypass,
        url: base,
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      },
      ...[...(user?.cookies.values() ?? [])].map((c) => ({
        name: c.name,
        value: c.value,
        url: base,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      })),
    ]);
    return context;
  };
  const orgA = await organization('Synthetic Staging A'),
    orgB = await organization('Synthetic Staging B');
  const a = await seed(orgA),
    b = await seed(orgB);
  const roles = [
    'organization_admin',
    'executive_approver',
    'capture_manager',
    'estimator',
    'contributor',
    'viewer',
  ];
  const users = [];
  for (const role of roles) users.push(await member(role, [orgA]));
  for (const user of users) {
    const privileged = ['organization_admin', 'executive_approver', 'estimator'].includes(
      user.role,
    );
    const rows = required(
      await user.client.from('profile_facts').select('id,sensitivity').eq('organization_id', orgA),
      'Fact JWT query failed',
    );
    check(rows.length === (privileged ? 3 : 1), `${user.role}: fact RLS classification`);
    check(
      required(
        await user.client.from('opportunities').select('id').eq('id', b.opp),
        'Foreign JWT query failed',
      ).length === 0,
      `${user.role}: foreign opportunity invisible`,
    );
    for (const table of [
      'insurance_records',
      'bonding_records',
      'key_personnel',
      'approved_subcontractors',
      'company_documents',
    ]) {
      check(
        required(
          await user.client.from(table).select('id').eq('organization_id', orgA),
          'Restricted JWT query failed',
        ).length === (privileged ? 1 : 0),
        `${user.role}: ${table} disclosure`,
      );
    }
    const context = await contextFor(user),
      page = await context.newPage();
    const status = await context.request.get(`${base}/api/assistant/status?organization=${orgA}`);
    const statusBody = await status.json();
    check(
      status.status() === 200 &&
        statusBody.access === `${user.id}:${user.role}` &&
        statusBody.available === mock,
      `${user.role}: hosted JWT identity and expected assistant mode`,
    );
    await page.goto(`${base}/assistant/sources/fact/${a.facts.workspace}?organization=${orgA}`);
    check(
      (await page.locator('body').innerText()).replaceAll('_', ' ').includes('SYNTHETIC WORKSPACE'),
      `${user.role}: permitted source resolves in browser`,
    );
    check(
      !(await page.locator('body').innerText())
        .replaceAll('_', ' ')
        .includes('PRIVATE SOURCE SENTINEL') &&
        !(await page.locator('body').innerText())
          .replaceAll('_', ' ')
          .includes('PRIVATE NOTES SENTINEL'),
      `${user.role}: source strips private notes`,
    );
    await page.goto(`${base}/assistant/sources/fact/${a.facts.restricted}?organization=${orgA}`);
    check(
      (await page.locator('body').innerText())
        .replaceAll('_', ' ')
        .includes('SYNTHETIC RESTRICTED') === privileged,
      `${user.role}: restricted citation browser disclosure`,
    );
    await page.goto(`${base}/assistant/sources/fact/${a.facts.unknown}?organization=${orgA}`);
    check(
      !(await page.locator('body').innerText()).replaceAll('_', ' ').includes('SYNTHETIC UNKNOWN'),
      `${user.role}: unknown excluded from AI source`,
    );
    await page.goto(`${base}/assistant/sources/opportunity/${b.opp}?organization=${orgB}`);
    check(
      !(await page.locator('body').innerText()).includes('Synthetic opportunity'),
      `${user.role}: foreign citation denied`,
    );
    const forged = await context.request.post(`${base}/api/assistant`, {
      headers: { origin: base },
      data: {
        organizationId: orgA,
        requestId: randomUUID(),
        prompt: 'Synthetic test',
        context: null,
        role: 'organization_admin',
      },
    });
    check(forged.status() === 400, `${user.role}: browser role injection rejected`);
    if (mock) {
      const response = await context.request.post(`${base}/api/assistant`, {
        headers: { origin: base },
        data: {
          organizationId: orgA,
          requestId: randomUUID(),
          prompt: `Synthetic role ${user.role}`,
          context: null,
        },
      });
      const events = (await response.text())
        .trim()
        .split('\n')
        .map((s) => JSON.parse(s));
      const answer = events.find((e) => e.type === 'answer');
      check(
        response.status() === 200 && !!answer,
        `${user.role}: real route streams mock-provider answer`,
      );
      const text = JSON.stringify(answer);
      check(
        text.includes('SYNTHETIC_WORKSPACE') &&
          text.includes('SYNTHETIC_RESTRICTED') === privileged &&
          !text.includes('SYNTHETIC_UNKNOWN') &&
          !text.includes('PRIVATE_'),
        `${user.role}: streamed evidence obeys disclosure rules`,
      );
    }
    if (user.role === 'viewer') {
      await page.goto(`${base}/assistant?organization=${orgA}`);
      if (mock) {
        await page.getByLabel('Ask about Synthetic Staging A').fill('Synthetic history privacy');
        await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Copy answer' })).toBeVisible({
          timeout: 20000,
        });
        check(
          (await page.locator('body').innerText()).includes('Synthetic history privacy'),
          'Real JWT browser conversation created with mock provider',
        );
      }
      await db.query(
        "update public.organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",
        [orgA, user.id],
      );
      const revoked = await context.request.get(
        `${base}/api/assistant/status?organization=${orgA}`,
      );
      check(
        revoked.status() === 401 && !(await revoked.json()).access,
        'Suspended member: existing browser session loses assistant access',
      );
      if (mock) {
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await expect(page.getByRole('button', { name: 'Copy answer' })).toHaveCount(0, {
          timeout: 20000,
        });
        check(
          !(await page.locator('body').innerText()).includes('Synthetic history privacy'),
          'Real membership suspension clears existing browser conversation',
        );
        check(
          await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0),
          'Real assistant conversation is absent from browser storage',
        );
      }
      check(
        (await reserve(user, orgA)) === 'forbidden',
        'Suspended member: existing real JWT reservation rejected',
      );
      await db.query(
        'delete from public.organization_memberships where organization_id=$1 and user_id=$2',
        [orgA, user.id],
      );
      const denied = await context.request.post(`${base}/api/assistant`, {
        headers: { origin: base },
        data: {
          organizationId: orgA,
          requestId: randomUUID(),
          prompt: 'Synthetic test',
          context: null,
        },
      });
      check(
        denied.status() === 403,
        'Revoked member: newly submitted request rejected from previously open tab',
      );
      await page.goto(`${base}/assistant/sources/fact/${a.facts.workspace}?organization=${orgA}`);
      check(
        !(await page.locator('body').innerText())
          .replaceAll('_', ' ')
          .includes('SYNTHETIC WORKSPACE'),
        'Revoked member: previously authorized citation stops resolving',
      );
    }
    await context.close();
  }
  const guest = await contextFor(null);
  const guestStatus = await guest.request.get(`${base}/api/assistant/status?organization=${orgA}`);
  check(guestStatus.status() === 401, 'Anonymous hosted assistant denied');
  check(
    (await anonymous.from('opportunities').select('id')).error !== null,
    'Anonymous PostgREST tenant read denied',
  );
  check(
    (
      await anonymous.rpc('reserve_ai_request', {
        org: orgA,
        request_id: randomUUID(),
        digest: 'a'.repeat(64),
        org_limit: 20,
        user_limit: 5,
      })
    ).error !== null,
    'Anonymous reservation execute denied',
  );
  await guest.close();
  if (mock) {
    const lifecycleOrg = await organization('Synthetic lifecycle'),
      lifecycleUser = await member('viewer', [lifecycleOrg]);
    const context = await contextFor(lifecycleUser),
      page = await context.newPage();
    const post = (prompt) =>
      context.request.post(`${base}/api/assistant`, {
        headers: { origin: base },
        data: { organizationId: lifecycleOrg, requestId: randomUUID(), prompt, context: null },
      });
    const failed = await post('STAGING_TEST_FAILURE'),
      failedText = await failed.text();
    check(
      failedText.includes('service_unavailable') &&
        !failedText.includes('Synthetic provider outage'),
      'Hosted mock provider failure is sanitized',
    );
    await page.goto(`${base}/assistant?organization=${lifecycleOrg}`);
    const cancelled = page.evaluate(
      async ({ org, requestId }) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 1500);
        try {
          const response = await fetch('/api/assistant', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              organizationId: org,
              requestId,
              prompt: 'STAGING_TEST_SLOW_CANCEL',
              context: null,
            }),
            signal: controller.signal,
          });
          await response.text();
          return false;
        } catch (e) {
          return e.name === 'AbortError';
        }
      },
      { org: lifecycleOrg, requestId: randomUUID() },
    );
    check(await cancelled, 'Real browser cancellation aborts the streaming request');
    const count = (
      await db.query(
        'select count(*)::int n from public.ai_usage_events where organization_id=$1',
        [lifecycleOrg],
      )
    ).rows[0].n;
    check(count === 2, 'Failure and cancelled requests both retain hosted quota reservations');
    const pending = post('STAGING_TEST_SLOW_REVOKE');
    await expect
      .poll(
        async () =>
          (
            await db.query(
              'select count(*)::int n from public.ai_usage_events where organization_id=$1',
              [lifecycleOrg],
            )
          ).rows[0].n,
        { timeout: 15000 },
      )
      .toBe(3);
    await db.query(
      "update public.organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",
      [lifecycleOrg, lifecycleUser.id],
    );
    const revokedText = await (await pending).text();
    check(
      revokedText.includes('forbidden') && !revokedText.includes('"type":"answer"'),
      'Revocation during generation prevents releasing an answer',
    );
    await context.close();
  }
  const perUser = await organization('Synthetic user cap', 100, 2),
    u = await member('viewer', [perUser]);
  const uc = await Promise.all(Array.from({ length: 12 }, () => reserve(u, perUser)));
  check(
    uc.filter((x) => x === 'reserved').length === 2 &&
      uc.filter((x) => x === 'rate_limited').length === 10,
    'Concurrent one-user daily cap: exactly 2 of 12 reserved',
  );
  const perOrg = await organization('Synthetic org cap', 4, 20),
    team = [];
  for (let i = 0; i < 4; i++) team.push(await member('contributor', [perOrg]));
  const oc = await Promise.all(Array.from({ length: 20 }, (_, i) => reserve(team[i % 4], perOrg)));
  check(
    oc.filter((x) => x === 'reserved').length === 4 &&
      oc.filter((x) => x === 'rate_limited').length === 16,
    'Concurrent multi-user organization cap: exactly 4 of 20 reserved',
  );
  const dupOrg = await organization('Synthetic duplicates'),
    du = await member('viewer', [dupOrg]);
  const rid = randomUUID(),
    digest = randomBytes(32).toString('hex');
  const ids = await Promise.all(
    Array.from({ length: 8 }, () => reserve(du, dupOrg, { request_id: rid })),
  );
  check(
    ids.filter((x) => x === 'reserved').length === 1 &&
      ids.filter((x) => x === 'duplicate').length === 7,
    'Concurrent duplicate request ID reserves once',
  );
  const digs = await Promise.all(Array.from({ length: 8 }, () => reserve(du, dupOrg, { digest })));
  check(
    digs.filter((x) => x === 'reserved').length === 1 &&
      digs.filter((x) => x === 'duplicate').length === 7,
    'Concurrent duplicate digest reserves once',
  );
  const crossA = await organization('Synthetic cross A', 100, 2),
    crossB = await organization('Synthetic cross B', 100, 2),
    cu = await member('viewer', [crossA, crossB]);
  const cross = await Promise.all(
    Array.from({ length: 12 }, (_, i) => reserve(cu, i % 2 ? crossA : crossB)),
  );
  check(
    cross.filter((x) => x === 'reserved').length === 2 &&
      cross.filter((x) => x === 'rate_limited').length === 10,
    'Daily user cap stays atomic across separate organizations',
  );
  const minuteOrg = await organization('Synthetic rolling minute'),
    mu = await member('viewer', [minuteOrg]);
  const minute = await Promise.all(Array.from({ length: 8 }, () => reserve(mu, minuteOrg)));
  check(
    minute.filter((x) => x === 'reserved').length === 3,
    'Rolling user minute cap reserves only 3 concurrent requests',
  );
  // Operator ages ONLY generated synthetic fixtures; no delay or production clock change.
  await db.query(
    "update public.ai_usage_events set created_at=now()-interval '61 seconds' where organization_id=$1",
    [minuteOrg],
  );
  check(
    (await reserve(mu, minuteOrg)) === 'reserved',
    'Rolling minute releases entries older than 60 seconds',
  );
  const minuteTeamOrg = await organization('Synthetic org minute'),
    mt = [];
  for (let i = 0; i < 4; i++) mt.push(await member('viewer', [minuteTeamOrg]));
  const mc = await Promise.all(
    Array.from({ length: 16 }, (_, i) => reserve(mt[i % 4], minuteTeamOrg)),
  );
  check(
    mc.filter((x) => x === 'reserved').length === 10 &&
      mc.filter((x) => x === 'rate_limited').length === 6,
    'Rolling organization minute cap reserves only 10 concurrent requests',
  );
  check(
    (
      await u.client.from('ai_usage_events').insert({
        id: randomUUID(),
        organization_id: perUser,
        user_id: u.id,
        prompt_digest: 'a'.repeat(64),
      })
    ).error !== null,
    'JWT cannot forge usage inserts',
  );
  check(
    (await u.client.from('ai_usage_events').delete().eq('organization_id', perUser)).error !== null,
    'JWT cannot refund reserved usage',
  );
  check(
    (await u.client.from('ai_usage_events').select('prompt_digest')).error !== null,
    'JWT cannot read stored prompt digests',
  );
  check(
    (
      await u.client
        .from('ai_organization_settings')
        .update({ enabled: false })
        .eq('organization_id', perUser)
    ).error !== null,
    'JWT cannot change operator AI settings',
  );
  check((await reserve(u, perUser)) === 'rate_limited', 'Uncompleted reservations remain charged');
  const mismatch = (
    await db.query(
      "select count(*)::int n from public.ai_usage_events u left join public.audit_events a on a.entity_id=u.id and a.action='AI_REQUEST_RESERVED' where u.organization_id=any($1::uuid[]) and (a.id is null or a.actor_user_id<>u.user_id)",
      [manifest.organizations],
    )
  ).rows[0].n;
  check(mismatch === 0, 'All hosted reservations have matching real-user audit attribution');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  // Assertion messages contain fixed labels only. Never emit SDK errors, cookies or raw HTTP bodies.
  report.failure =
    error instanceof assert.AssertionError
      ? error.message
      : 'Hosted test operation failed; inspect the failing stage without logging credentials.';
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  try {
    await cleanup();
    console.log(
      'Synthetic fixture cleanup completed; protected last-admin shells quarantined and users banned.',
    );
  } catch {
    report.cleaned = false;
    console.error('Cleanup incomplete; retry using the staging-only ID manifest.');
    process.exitCode = 1;
  }
  await db.end();
  writeFileSync('.tmp/staging-hosted-report.json', JSON.stringify(report, null, 2));
  console.log(
    `Hosted staging checks: ${report.checks.length}; ${report.status}; cleaned=${report.cleaned}; provider calls=0.`,
  );
}
