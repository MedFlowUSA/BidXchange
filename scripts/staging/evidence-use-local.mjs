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
let user, browser, server, fact, opportunity, pursuit, requirement;
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
  const card = page.locator(`#requirement-${requirement}`);
  await expect(card).toBeVisible({ timeout: 20000 });
  await card.getByText('Review evidence use', { exact: true }).click();
  const form = card.getByRole('form', { name: 'Review evidence use' });
  await form.getByLabel('Company evidence', { exact: true }).selectOption(fact);
  await form.getByLabel('Applicability', { exact: true }).selectOption('applicable');
  await form.getByLabel('Proposal use', { exact: true }).selectOption('approved');
  await form
    .getByLabel('Reason and limits', { exact: true })
    .fill('Synthetic reviewer confirms this license for section 2 only.');
  await form.getByRole('button', { name: 'Save evidence-use review', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Review saved', { timeout: 20000 });
  await page.reload();
  await expect(card).toContainText('Approved for this requirement');
  const saved = await client
    .from('current_evidence_use_reviews')
    .select('*')
    .eq('requirement_id', requirement)
    .single();
  assert(!saved.error && saved.data.approval_current === true);
  assert.equal(saved.data.reviewed_by, user);
  console.log('PASS signed-in human approval, stamped identity and current status after reload');
  await card.getByText('Review evidence use', { exact: true }).click();
  await form.getByLabel('Company evidence', { exact: true }).selectOption(fact);
  await form.getByLabel('Applicability', { exact: true }).selectOption('applicable');
  await form.getByLabel('Proposal use', { exact: true }).selectOption('approved');
  await form.getByLabel('Reason and limits', { exact: true }).fill('Stale review must not save');
  assert(
    !(await client.from('profile_facts').update({ source_note: 'Corrected source' }).eq('id', fact))
      .error,
  );
  const started = Date.now();
  const staleAttempt = await client
    .from('evidence_use_reviews')
    .insert({
      organization_id: org,
      requirement_id: requirement,
      fact_id: fact,
      fact_version: saved.data.fact_version,
      requirement_version: saved.data.requirement_version,
      applicability: 'applicable',
      proposal_use: 'approved',
      reason: 'Stale direct check',
    })
    .abortSignal(AbortSignal.timeout(15000));
  console.log('Stale API response:', staleAttempt.error?.code, 'elapsed ms:', Date.now() - started);
  assert.equal(staleAttempt.error?.code, 'P0001');
  await form.getByRole('button', { name: 'Save evidence-use review', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Review not saved');
  await expect(form.getByLabel('Reason and limits', { exact: true })).toHaveValue(
    'Stale review must not save',
  );
  await page.reload();
  await expect(card).toContainText('Previous approval needs review');
  assert.equal(
    (await client.from('profile_facts').select('verification_status').eq('id', fact).single()).data
      .verification_status,
    'pending_verification',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log(
    'PASS changed source clears verification, invalidates approval and rejects stale browser draft without losing text; mobile fits',
  );
  await db.query(
    "update public.organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",
    [org, user],
  );
  await page.reload();
  await expect(card.getByRole('form', { name: 'Review evidence use' })).toHaveCount(0);
  await expect(card).not.toContainText('Synthetic reviewer confirms');
  const hidden = await client
    .from('evidence_use_reviews')
    .select('id')
    .eq('requirement_id', requirement);
  assert(!hidden.error && hidden.data.length === 0);
  assert(
    (
      await client.from('evidence_use_reviews').insert({
        organization_id: org,
        requirement_id: requirement,
        fact_id: fact,
        fact_version: saved.data.fact_version,
        requirement_version: saved.data.requirement_version,
        applicability: 'applicable',
        proposal_use: 'approved',
        reason: 'Forbidden',
      })
    ).error,
  );
  console.log('PASS viewer cannot see restricted review notes or submit a review via direct API');
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
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
