// Hosted staging auth/PostgREST/database with the local app; fictional records only.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect as baseExpect } from '@playwright/test';
import { stagingKeys, stagingRef, stagingDatabase } from './connection.mjs';
const base = 'http://127.0.0.1:3108';
const expect = baseExpect.configure({ timeout: 20000 });
const keys = stagingKeys(),
  db = await stagingDatabase();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const auth = createClient(`https://${stagingRef}.supabase.co`, keys.service, options);
const users = [],
  orgs = [];
let browser,
  activePage,
  step = 'startup';
const flags = [
  'SELF_SERVICE',
  'EVIDENCE_MONITOR',
  'STRUCTURED_PROFILES',
  'CONTRACTOR_WORKFLOW',
  'REGISTER_SIGNOFF',
  'RELEASES',
  'EVIDENCE_REVIEWS',
  'DECISIONS',
  'RESOLUTIONS',
  'DECISION_MEMORY',
  'AMENDMENT_COMPARISON',
];
const server = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'dev',
    'apps/web',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3108',
  ],
  {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      SUPABASE_URL: `https://${stagingRef}.supabase.co`,
      SUPABASE_PUBLISHABLE_KEY: keys.anon,
      SITE_URL: base,
      ...Object.fromEntries(flags.map((f) => [`BIDXCHANGE_${f}_ENABLED`, 'true'])),
      BIDXCHANGE_AI_ENABLED: 'false',
    },
  },
);
const row = async (sql, args = []) => (await db.query(sql, args)).rows[0];
try {
  let ready = false;
  for (let n = 0; n < 60; n++) {
    try {
      if ((await fetch(base + '/signup')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert(ready, 'Local staging app unavailable');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  async function account() {
    const email = `amendment-comparison-${randomUUID()}@example.invalid`,
      password = randomBytes(32).toString('base64url');
    const generated = await auth.auth.admin.generateLink({ type: 'signup', email, password });
    assert(!generated.error, 'Synthetic account creation failed');
    const id = generated.data.user.id;
    users.push(id);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
      page = await context.newPage();
    await page.goto(
      base +
        '/auth/callback?token_hash=' +
        encodeURIComponent(generated.data.properties.hashed_token) +
        '&next=%2Fonboarding',
    );
    await expect(page.getByRole('heading', { name: 'Create or join a company' })).toBeVisible();
    const client = createClient(`https://${stagingRef}.supabase.co`, keys.anon, options);
    assert(
      !(await client.auth.signInWithPassword({ email, password })).error,
      'Synthetic API sign-in failed',
    );
    return { id, page, client };
  }
  step = 'synthetic accounts';
  const owner = await account(),
    viewer = await account(),
    foreign = await account();
  activePage = owner.page;
  async function organization(user) {
    const { id } = await row(
      "insert into public.organizations(legal_name,operating_name,slug) values('Fictional Amendment Comparison LLC','Synthetic Amendment Comparison',$1) returning id",
      ['memory-' + randomUUID()],
    );
    orgs.push(id);
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin')",
      [id, user.id],
    );
    await db.query('insert into public.company_profiles(organization_id) values($1)', [id]);
    return id;
  }
  const org = await organization(owner);
  await organization(foreign);
  await db.query(
    "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'viewer')",
    [org, viewer.id],
  );
  const original = await row(
    "insert into public.opportunities(organization_id,title,buyer,summary) values($1,'Fictional C-10 lighting','Example City','Bid bond and mandatory job walk') returning id",
    [org],
  );
  const pursuit = await row(
    "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Fictional lighting') returning id",
    [org, original.id],
  );
  const requirement = await row(
    "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation,status) values($1,$2,'Bid bond required','Fictional section 4','blocked') returning id",
    [org, pursuit.id],
  );
  const target = await row(
    "insert into public.opportunities(organization_id,title,buyer,summary) values($1,'Fictional C-10 retrofit','Example City','Bond and job walk required') returning id",
    [org],
  );
  const url = base + '/opportunities/' + target.id + '?organization=' + org;
  step = 'human register sign-off';
  await owner.page.goto(base + '/pursuits/' + pursuit.id + '?organization=' + org);
  const signoff = owner.page.locator('#register-signoff');
  await signoff
    .getByLabel('Register review note')
    .fill('Reviewed fictional source and unresolved bonding requirement.');
  await signoff.getByRole('checkbox').check();
  await signoff
    .getByRole('button', { name: 'Sign off Requirements Register', exact: true })
    .click();
  await signoff.getByRole('button', { name: 'Refresh sign-off status' }).click();
  await expect(signoff).toContainText('A human sign-off matches this review context.');
  step = 'human no-bid with structured reasons';
  await owner.page
    .locator('#bid-decision summary')
    .filter({ hasText: /^Record a decision$/ })
    .click();
  const decision = owner.page.getByRole('form', { name: 'Record pursuit decision' });
  await decision.getByLabel('Decision', { exact: true }).selectOption('no_bid');
  await decision.getByLabel('Bond capacity', { exact: true }).check();
  await decision.getByLabel('Job walk / pre-bid conflict', { exact: true }).check();
  await decision
    .getByLabel('Reason', { exact: true })
    .fill('Fictional capacity and meeting conflict.');
  await decision.getByRole('checkbox', { name: /I reviewed the opportunity/ }).check();
  await decision.getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(decision.getByRole('button', { name: 'View recorded decision' })).toBeVisible();
  const saved = await row(
    'select * from public.pursuit_decision_history where organization_id=$1',
    [org],
  );
  assert.deepEqual(saved.reason_codes, ['bond', 'site_visit']);
  assert.equal(saved.review_snapshot.requirements[0].text, 'Bid bond required');
  step = 'save candidate comparison without changing requirements';
  const pursuitUrl = base + '/pursuits/' + pursuit.id + '?organization=' + org;
  await owner.page.goto(pursuitUrl);
  const comparisonPanel = owner.page.getByRole('region', {
    name: 'Compare solicitation amendments',
  });
  const originalText =
    'License: C-10 required.\nBid bond: 5%.\nInsurance: $1 million per occurrence.\nBids due June 1 at 2pm PST.\nMandatory job walk May 1.\nScope: install lighting.';
  const amendedText =
    'License: C-10 required.\nBid bond: 10%.\nInsurance: $2 million per occurrence.\nBids due June 2 at 2pm.\nMandatory job walk May 2.\nScope: install lighting and controls.';
  async function createComparison(label) {
    await comparisonPanel
      .locator('summary')
      .filter({ hasText: /^Create amendment comparison$/ })
      .click();
    const form = owner.page.getByRole('form', { name: 'Create amendment comparison', exact: true });
    await form.getByLabel('Comparison / amendment label').fill(label);
    await form.getByLabel('Original official URL').fill('https://example.gov/original');
    await form.getByLabel('Amended official URL').fill('https://example.gov/amended');
    await form.getByLabel('Original public excerpt').fill(originalText);
    await form.getByLabel('Amended public excerpt').fill(amendedText);
    await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'Save candidate comparison' }).click();
    await expect(form.getByRole('status')).toContainText(
      'No amendment or requirement status has changed',
    );
  }
  await createComparison('Synthetic Amendment 1');
  assert.equal(
    (await row('select status from public.pursuit_requirements where id=$1', [requirement.id]))
      .status,
    'blocked',
  );
  assert.equal(
    (
      await row(
        'select count(*)::int n from public.opportunity_amendments where organization_id=$1',
        [org],
      )
    ).n,
    0,
  );
  const candidate = await row(
    'select * from public.amendment_comparisons where organization_id=$1',
    [org],
  );
  assert.equal(candidate.original_text.replace(/\r\n/g, '\n'), originalText);
  await expect(signoff).toContainText('A human sign-off matches this review context.');
  await comparisonPanel
    .locator('summary')
    .filter({ hasText: /^Synthetic Amendment 1/ })
    .click();
  await expect(comparisonPanel).toContainText('Bid bond: 5%.');
  await expect(comparisonPanel).toContainText('Bid bond: 10%.');
  await expect(comparisonPanel).toContainText('Excerpt line 2');
  await comparisonPanel.screenshot({ path: '.tmp/amendment-comparison-desktop.png' });
  await owner.page.setViewportSize({ width: 390, height: 844 });
  assert(await owner.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await comparisonPanel.screenshot({ path: '.tmp/amendment-comparison-mobile.png' });
  step = 'human confirmation and idempotence';
  const review = owner.page.getByRole('form', { name: 'Review comparison Synthetic Amendment 1' });
  await review.getByLabel('Review outcome').selectOption('confirmed');
  await review.getByLabel('Bid bond required', { exact: true }).check();
  await review
    .getByLabel('Findings, corrections and source references')
    .fill(
      'Human checked fictional bond increase and changed meeting. Check missing time zone with buyer.',
    );
  await review.getByRole('checkbox', { name: /I reviewed the official source/ }).check();
  await review.getByRole('button', { name: 'Save human review' }).click();
  await expect(
    comparisonPanel.locator('summary').filter({ hasText: /^Synthetic Amendment 1/ }),
  ).toContainText('Amendment recorded');
  await expect(signoff).toContainText('This sign-off is stale');
  assert.equal(
    (await row('select status from public.pursuit_requirements where id=$1', [requirement.id]))
      .status,
    'needs_review',
  );
  assert.deepEqual(
    await row('select * from public.pursuit_decision_history where id=$1', [saved.id]),
    saved,
  );
  const humanReview = await row(
    'select * from public.amendment_comparison_reviews where comparison_id=$1',
    [candidate.id],
  );
  const confirmArgs = {
    org,
    comparison: candidate.id,
    choice: 'confirmed',
    explanation: humanReview.note,
    affected: [requirement.id],
    acknowledged: true,
  };
  const repeat = await owner.client.rpc('confirm_amendment_comparison', confirmArgs);
  assert(!repeat.error);
  assert.equal(repeat.data, humanReview.id);
  assert.equal(
    (
      await row(
        'select count(*)::int n from public.opportunity_amendments where organization_id=$1',
        [org],
      )
    ).n,
    1,
  );
  step = 'role and tenant isolation';
  for (const account of [viewer, foreign]) {
    const hidden = await account.client
      .from('amendment_comparisons')
      .select('id')
      .eq('organization_id', org);
    assert(!hidden.error);
    assert.deepEqual(hidden.data, []);
    const denied = await account.client.rpc('confirm_amendment_comparison', confirmArgs);
    assert(denied.error?.message.includes('Capture access required'));
  }
  await viewer.page.goto(pursuitUrl);
  await expect(
    viewer.page.getByRole('region', { name: 'Compare solicitation amendments' }),
  ).toHaveCount(0);
  step = 'stale comparison and dismissal';
  await owner.page.reload();
  await createComparison('Synthetic Amendment 2');
  const newer = await row(
    'select * from public.amendment_comparisons where organization_id=$1 order by created_at desc limit 1',
    [org],
  );
  await db.query(
    "update public.pursuit_requirements set requirement='Changed later bond requirement' where id=$1",
    [requirement.id],
  );
  const stale = await owner.client.rpc('confirm_amendment_comparison', {
    ...confirmArgs,
    comparison: newer.id,
  });
  assert(stale.error?.message.includes('Records changed'));
  await owner.page.reload();
  await comparisonPanel
    .locator('summary')
    .filter({ hasText: /^Synthetic Amendment 2/ })
    .click();
  const staleForm = owner.page.getByRole('form', {
    name: 'Review comparison Synthetic Amendment 2',
  });
  await expect(staleForm.locator('option[value="confirmed"]')).toHaveJSProperty('disabled', true);
  await staleForm.getByLabel('Review outcome').selectOption('dismissed');
  await staleForm
    .getByLabel('Findings, corrections and source references')
    .fill('Outdated comparison; recreate against current register.');
  await staleForm.getByRole('checkbox', { name: /I reviewed the official source/ }).check();
  await staleForm.getByRole('button', { name: 'Save human review' }).click();
  await expect(
    comparisonPanel.locator('summary').filter({ hasText: /^Synthetic Amendment 2/ }),
  ).toContainText('Dismissed');
  assert.equal(
    (
      await row(
        'select count(*)::int n from public.opportunity_amendments where organization_id=$1',
        [org],
      )
    ).n,
    1,
  );
  console.log(
    'PASS hosted amendment comparison: saved source snapshots and clause diff, no candidate mutation, human confirmation, stale register, unchanged history, idempotence, role/tenant isolation, stale rejection, dismissal, desktop/mobile.',
  );
} catch (error) {
  if (error?.code === 'ERR_ASSERTION') console.error(String(error.message).slice(0, 800));
  if (['stale comparison and dismissal', 'human confirmation and idempotence'].includes(step))
    console.error(String(error.message).slice(0, 1500));
  if (activePage && !activePage.url().includes('/auth/callback'))
    await activePage
      .screenshot({ path: '.tmp/amendment-comparison-staging-failure.png', fullPage: true })
      .catch(() => {});
  console.error(
    'FAIL at ' +
      step +
      '; ' +
      (error?.code ?? error?.name ?? 'CHECK_FAILED') +
      '. Provider/session details withheld.',
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const id of orgs)
    await db.query(
      "update public.organizations set status='suspended' where id=$1 and operating_name='Synthetic Amendment Comparison'",
      [id],
    );
  for (const id of users)
    assert(!(await auth.auth.admin.updateUserById(id, { ban_duration: '876000h' })).error);
  await db.end();
  if (server.pid)
    try {
      execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {}
  console.log('Synthetic accounts banned and workspaces suspended; no production records used.');
}
