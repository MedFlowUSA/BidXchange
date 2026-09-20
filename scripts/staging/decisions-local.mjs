import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { chromium, expect as baseExpect } from '@playwright/test';
import { stagingDatabase, stagingKeys, stagingRef } from './connection.mjs';
const base = 'http://127.0.0.1:3101';
const expect = baseExpect.configure({ timeout: 20000 });
const db = await stagingDatabase(),
  keys = stagingKeys(),
  url = `https://${stagingRef}.supabase.co`;
const admin = createClient(url, keys.service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const org = (
  await db.query(
    "select o.id from public.organizations o where o.status='suspended' and o.slug like 'staging-test-%' and exists(select 1 from public.organization_memberships m where m.organization_id=o.id and m.role='organization_admin' and m.status='active') and not exists(select 1 from public.organization_memberships m join auth.users u on u.id=m.user_id where m.organization_id=o.id and m.status='active' and (u.banned_until is null or u.banned_until<now())) order by o.created_at limit 1",
  )
).rows[0]?.id;
assert(org, 'No quarantined synthetic fixture available');
const label = `Synthetic evidence ${randomUUID()}`;
let user, browser, server, fact, opportunity, pursuit, requirement, task;
const priorProfile = (
  await db.query('select id from public.company_profiles where organization_id=$1', [org])
).rows[0]?.id;
try {
  server = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'dev',
      '--webpack',
      '.tmp/staging-app/apps/web',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3101',
    ],
    {
      stdio: 'ignore',
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS,
        SUPABASE_URL: url,
        SUPABASE_PUBLISHABLE_KEY: keys.anon,
        BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED: 'true',
        BIDXCHANGE_DECISIONS_ENABLED: 'true',
        BIDXCHANGE_AI_ENABLED: 'false',
        BIDXCHANGE_AI_DEMO_ENABLED: 'false',
      },
    },
  );
  server.on('error', () => {});
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert(ready && server.exitCode === null, 'Local staging-backed app did not start');
  const email = `record-${randomUUID()}@example.invalid`,
    password = randomBytes(24).toString('base64url');
  const made = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert(!made.error);
  user = made.data.user.id;
  await db.query("update public.organizations set status='active' where id=$1", [org]);
  await db.query(
    "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin')",
    [org, user],
  );
  const cookies = new Map();
  const client = createServerClient(url, keys.anon, {
    cookies: {
      getAll: () => [...cookies.values()],
      setAll: (values) => values.forEach((c) => cookies.set(c.name, c)),
    },
  });
  assert(!(await client.auth.signInWithPassword({ email, password })).error);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  await context.addCookies(
    [...cookies.values()].map((c) => ({
      name: c.name,
      value: c.value,
      url: base,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    })),
  );
  const profile =
    priorProfile ??
    (
      await db.query(
        'insert into public.company_profiles(organization_id) values($1) returning id',
        [org],
      )
    ).rows[0].id;
  fact = (
    await db.query(
      "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value,source_reference,sensitivity) values($1,$2,'license',$3,'B','Synthetic registry','restricted') returning id",
      [org, profile, label],
    )
  ).rows[0].id;
  opportunity = (
    await db.query(
      'insert into public.opportunities(organization_id,title) values($1,$2) returning id',
      [org, label],
    )
  ).rows[0].id;
  pursuit = (
    await db.query(
      'insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,$3) returning id',
      [org, opportunity, label],
    )
  ).rows[0].id;
  requirement = (
    await db.query(
      "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation) values($1,$2,'Synthetic license requirement','Section 2') returning id",
      [org, pursuit],
    )
  ).rows[0].id;
  assert(
    !(await client.from('profile_facts').update({ verification_status: 'verified' }).eq('id', fact))
      .error,
  );

  const page = await context.newPage();
  await page.goto(`${base}/pursuits/${pursuit}?organization=${org}`);
  const panel = page.getByRole('region', { name: 'Bid/no-bid decision', exact: true });
  await expect(panel).toContainText('No human decision recorded');
  const form = panel.getByRole('form', { name: 'Record pursuit decision' });
  async function draft(outcome, reason) {
    await panel.getByText('Record a decision', { exact: true }).click();
    await form.getByLabel('Decision', { exact: true }).selectOption(outcome);
    await form.getByLabel('Reason', { exact: true }).fill(reason);
    await form
      .getByLabel('Conditions and unresolved risks', { exact: true })
      .fill('Resolve license scope and separately approve final pricing.');
    await form.getByRole('checkbox').check();
  }
  await draft('bid', 'Synthetic decision: pursue subject to review.');
  await form.getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Decision recorded');
  await page.reload();
  await expect(panel.getByRole('heading', { name: 'Pursue bid', exact: true })).toBeVisible();
  const history = await client
    .from('pursuit_decision_history')
    .select('*')
    .eq('pursuit_id', pursuit);
  assert(!history.error && history.data.length === 1);
  assert.equal(history.data[0].decided_by, user);
  await expect(panel).not.toContainText('Review again:');
  await draft('no_bid', 'Stale decision must be retained but not recorded.');
  assert(
    !(await client.from('profile_facts').update({ source_note: 'Amended source' }).eq('id', fact))
      .error,
  );
  await form.getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Decision not recorded');
  await expect(form.getByLabel('Reason', { exact: true })).toHaveValue(
    'Stale decision must be retained but not recorded.',
  );
  await page.reload();
  await expect(panel).toContainText('Review again:');
  await draft('no_bid', 'Synthetic decision: decline after source amendment.');
  await form.getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Decision recorded');
  await page.reload();
  await expect(panel.getByRole('heading', { name: 'Do not bid', exact: true })).toBeVisible();
  await draft('pending', 'Synthetic decision: reopen for new information.');
  await form.getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Decision recorded');
  await page.reload();
  await expect(panel.getByRole('heading', { name: 'Reopen review', exact: true })).toBeVisible();
  await panel.getByText('Decision history · latest 3', { exact: true }).click();
  await expect(panel).toContainText('Synthetic decision: pursue subject to review.');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log(
    'PASS attributed bid/no-bid/reopen, immutable history, stale-context rejection with retained draft, review-again notice and mobile layout',
  );
  task = (
    await db.query(
      "insert into public.pursuit_tasks(organization_id,pursuit_id,title,assigned_user_id,due_at,due_timezone) values($1,$2,'Synthetic follow-up task',$3,now()-interval '1 day','UTC') returning id",
      [org, pursuit, user],
    )
  ).rows[0].id;
  await page.goto(`${base}/dashboard?organization=${org}`);
  const queue = page.getByRole('region', { name: 'Work that needs attention' });
  await expect(queue).toContainText('Overdue');
  await queue.getByRole('checkbox').check();
  await queue.getByRole('link', { name: 'Synthetic follow-up task' }).click();
  await expect(page.locator(`#task-${task}`)).toBeVisible();
  assert(!(await client.from('pursuit_tasks').update({ status: 'complete' }).eq('id', task)).error);
  await page.goto(`${base}/dashboard?organization=${org}`);
  await expect(queue).not.toContainText('Synthetic follow-up task');
  await page.goto(`${base}/pursuits/${pursuit}?organization=${org}`);
  console.log(
    'PASS Today overdue queue, assigned-to-me filter, direct task link and completed-task removal',
  );
  await page.goto(`${base}/opportunities/${opportunity}?organization=${org}`);
  await page.getByText('Edit opportunity', { exact: true }).first().click();
  const edit = page.getByRole('form', { name: 'Edit opportunity' });
  await edit.locator('[name="source_note"]').fill('Synthetic buyer notice');
  await edit.getByRole('button', { name: 'Edit opportunity', exact: true }).click();
  await expect(edit.getByRole('link', { name: 'Open workspace record' })).toHaveAttribute(
    'href',
    `/opportunities/${opportunity}?organization=${org}`,
  );
  await edit.getByRole('link', { name: 'Open workspace record' }).click();
  await page.goto(`${base}/pursuits/${pursuit}?organization=${org}`);
  console.log('PASS opportunity save provides a direct scoped record link');
  const currentVersion = (
    await client.from('pursuits').select('updated_at').eq('id', pursuit).single()
  ).data.updated_at;
  const currentContext = (await client.rpc('pursuit_decision_context', { org, pursuit })).data;
  const concurrent = {
    org,
    pursuit,
    expected_version: currentVersion,
    expected_context: currentContext,
    outcome: 'pending',
    rationale: 'Synthetic concurrent review',
    limits: '',
  };
  const results = await Promise.all([
    client.rpc('record_pursuit_decision', concurrent),
    client.rpc('record_pursuit_decision', concurrent),
  ]);
  assert.equal(results.filter((r) => !r.error).length, 1);
  console.log('PASS concurrent decisions from one review version admit exactly one record');
  await db.query(
    "update public.organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",
    [org, user],
  );
  await page.reload();
  await expect(panel.getByText('Record a decision', { exact: true })).toHaveCount(0);
  await expect(panel.getByRole('heading', { name: 'Reopen review', exact: true })).toBeVisible();
  assert(
    (
      await client.rpc('record_pursuit_decision', {
        org,
        pursuit,
        expected_version: new Date().toISOString(),
        expected_context: 'x',
        outcome: 'bid',
        rationale: 'forbidden',
        limits: '',
      })
    ).error,
  );
  console.log(
    'PASS viewer can read shared decision history but cannot record decisions through UI or direct API',
  );
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
  if (task)
    await db.query('delete from public.pursuit_tasks where organization_id=$1 and id=$2', [
      org,
      task,
    ]);
  if (pursuit)
    await db.query(
      'delete from public.pursuit_decision_history where organization_id=$1 and pursuit_id=$2',
      [org, pursuit],
    );
  if (requirement) {
    await db.query(
      'delete from public.evidence_use_reviews where organization_id=$1 and requirement_id=$2',
      [org, requirement],
    );
    await db.query('delete from public.pursuit_requirements where organization_id=$1 and id=$2', [
      org,
      requirement,
    ]);
  }
  if (pursuit)
    await db.query('delete from public.pursuits where organization_id=$1 and id=$2', [
      org,
      pursuit,
    ]);
  if (opportunity)
    await db.query('delete from public.opportunities where organization_id=$1 and id=$2', [
      org,
      opportunity,
    ]);
  if (fact)
    await db.query('delete from public.profile_facts where organization_id=$1 and id=$2', [
      org,
      fact,
    ]);
  if (user)
    await db.query(
      'delete from public.organization_memberships where organization_id=$1 and user_id=$2',
      [org, user],
    );
  if (!priorProfile)
    await db.query('delete from public.company_profiles where organization_id=$1', [org]);
  await db.query("update public.organizations set status='suspended' where id=$1", [org]);
  if (user) assert(!(await admin.auth.admin.deleteUser(user)).error);
  await db.end();
  console.log('Synthetic records/account removed and shell suspended.');
}
