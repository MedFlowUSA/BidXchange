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
        BIDXCHANGE_DECISIONS_ENABLED: 'true',
        BIDXCHANGE_RESOLUTIONS_ENABLED: 'true',
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
  const route = `${base}/pursuits/${pursuit}?organization=${org}`;
  await page.goto(route);
  const card = page.locator(`#requirement-${requirement}`);
  const resolution = card.getByRole('region', { name: 'Requirement resolution' });
  const form = resolution.getByRole('form', { name: 'Resolve requirement' });
  const brief = page.getByRole('region', { name: 'What still needs a decision?' });
  async function draft(outcome, reason) {
    await resolution.getByText('Resolve requirement', { exact: true }).click();
    await form.getByLabel('Disposition', { exact: true }).selectOption(outcome);
    await form.getByLabel('Reason and remaining limits', { exact: true }).fill(reason);
  }
  async function save() {
    await form.getByRole('button', { name: 'Save requirement review', exact: true }).click();
    await expect(form.getByRole('status')).toContainText('Requirement review recorded');
    await page.reload();
  }
  await expect(resolution).toContainText('No requirement disposition recorded');
  await draft('supported', 'Synthetic support assessment');
  await expect(form).toContainText('Approve the use of current evidence below');
  await expect(form.locator('select[name="disposition"] option[value="waived"]')).toHaveCount(0);
  await page.reload();
  await card.getByText('Review evidence use', { exact: true }).click();
  const evidenceForm = card.getByRole('form', { name: 'Review evidence use' });
  await evidenceForm.getByLabel('Company evidence', { exact: true }).selectOption(fact);
  await evidenceForm.getByLabel('Applicability', { exact: true }).selectOption('applicable');
  await evidenceForm.getByLabel('Proposal use', { exact: true }).selectOption('approved');
  await evidenceForm
    .getByLabel('Reason and limits', { exact: true })
    .fill('Private synthetic evidence notes');
  await evidenceForm.getByRole('button', { name: 'Save evidence-use review', exact: true }).click();
  await expect(evidenceForm.getByRole('status')).toContainText('Review saved');
  await page.reload();
  const evidence = (
    await client
      .from('current_evidence_use_reviews')
      .select('id')
      .eq('requirement_id', requirement)
      .single()
  ).data.id;
  const pVersion = (await client.from('pursuits').select('updated_at').eq('id', pursuit).single())
    .data.updated_at;
  const token = (await client.rpc('pursuit_decision_context', { org, pursuit })).data;
  assert(
    !(
      await client.rpc('record_pursuit_decision', {
        org,
        pursuit,
        expected_version: pVersion,
        expected_context: token,
        outcome: 'pending',
        rationale: 'Synthetic decision before resolution',
        limits: '',
      })
    ).error,
  );
  await page.reload();
  await draft('supported', 'Synthetic requirement supported within the cited scope.');
  await form
    .getByLabel('Approved evidence for this requirement', { exact: true })
    .selectOption(evidence);
  await save();
  await expect(resolution).toContainText('Supported by reviewed evidence');
  await expect(brief).toContainText('Requirement review: Supported by reviewed evidence');
  await expect(
    page.getByRole('region', { name: 'Bid/no-bid decision', exact: true }),
  ).toContainText('Review again:');
  const get = async () =>
    (
      await client
        .from('current_requirement_resolutions')
        .select('*')
        .eq('requirement_id', requirement)
        .single()
    ).data;
  assert.equal((await get()).reviewed_by, user);
  assert.equal((await get()).review_current, true);
  await draft('blocked', 'Stale rationale must remain in this draft.');
  const latest = await get();
  const version = (
    await client.from('pursuit_requirements').select('updated_at').eq('id', requirement).single()
  ).data.updated_at;
  const change = {
    org,
    target_requirement: requirement,
    expected_version: version,
    expected_previous: latest.id,
    outcome: 'awaiting_clarification',
    rationale: 'Synthetic concurrent clarification',
    evidence_review: null,
    issuing_authority: '',
    waiver_reference: '',
  };
  const race = await Promise.all([
    client.rpc('resolve_pursuit_requirement', change),
    client.rpc('resolve_pursuit_requirement', change),
  ]);
  assert.equal(race.filter((r) => !r.error).length, 1);
  await form.getByRole('button', { name: 'Save requirement review', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Review not saved');
  await expect(form.getByLabel('Reason and remaining limits', { exact: true })).toHaveValue(
    'Stale rationale must remain in this draft.',
  );
  await page.reload();
  await expect(brief).toContainText('Awaiting clarification');
  await draft('supported', 'Synthetic support restored for source-change check.');
  await form
    .getByLabel('Approved evidence for this requirement', { exact: true })
    .selectOption(evidence);
  await save();
  assert(
    !(await client.from('profile_facts').update({ source_note: 'Corrected source' }).eq('id', fact))
      .error,
  );
  await page.reload();
  await expect(resolution).toContainText('Needs another review');
  await expect(brief).toContainText('Requirement review is no longer current');
  await draft('blocked', 'Synthetic unresolved source discrepancy.');
  await save();
  await expect(brief).toContainText('Blocked follow-up');
  await db.query(
    "update public.organization_memberships set role='executive_approver' where organization_id=$1 and user_id=$2",
    [org, user],
  );
  await page.reload();
  await draft('waived', 'Synthetic documented buyer waiver with limited scope.');
  await form
    .getByLabel('Issuing authority', { exact: true })
    .fill('Synthetic buyer contracting officer');
  await form
    .getByLabel('Waiver source and scope', { exact: true })
    .fill('Synthetic amendment 2, section 3; this requirement only.');
  await save();
  await expect(resolution).toContainText('Documented buyer waiver');
  await expect(brief).not.toContainText('Blocked follow-up');
  await resolution.getByText('Requirement review history', { exact: true }).click();
  await expect(resolution).toContainText('Synthetic requirement supported within the cited scope.');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log(
    'PASS supported/blocked/clarification/waiver reviews, attributed history, bid-review invalidation, evidence correction, concurrent and stale-review rejection, and mobile layout',
  );
  await db.query(
    "update public.organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",
    [org, user],
  );
  await page.reload();
  await expect(resolution).toContainText('Needs another review');
  await expect(resolution.getByText('Resolve requirement', { exact: true })).toHaveCount(0);
  await expect(card).not.toContainText('Private synthetic evidence notes');
  assert(
    (
      await client
        .from('requirement_resolution_history')
        .select('evidence_review_id')
        .eq('requirement_id', requirement)
    ).error,
  );
  assert((await client.rpc('resolve_pursuit_requirement', change)).error);
  console.log(
    'PASS reviewer-authority revocation invalidates waiver; viewer reads shared outcome but cannot review or access protected evidence linkage',
  );
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
  if (requirement)
    await db.query(
      'delete from public.requirement_resolution_history where organization_id=$1 and requirement_id=$2',
      [org, requirement],
    );
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
