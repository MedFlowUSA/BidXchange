// Hosted staging auth/PostgREST/database with the local app; fictional records only.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect as baseExpect } from '@playwright/test';
import { stagingKeys, stagingRef, stagingDatabase } from './connection.mjs';
const base = 'http://127.0.0.1:3107';
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
    '3107',
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
    const email = `decision-memory-${randomUUID()}@example.invalid`,
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
      "insert into public.organizations(legal_name,operating_name,slug) values('Fictional Decision Memory LLC','Synthetic Decision Memory',$1) returning id",
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
  step = 'company log and frozen snapshot';
  await owner.page.goto(base + '/company?organization=' + org + '#company-decisions');
  const log = owner.page.getByRole('region', { name: 'Company Decision Log', exact: true });
  await expect(log.getByRole('heading', { name: 'Fictional C-10 lighting' })).toBeVisible();
  await log.getByText('Requirements at decision time', { exact: true }).click();
  await expect(log).toContainText('Fictional section 4');
  await db.query("update public.pursuit_requirements set requirement='Later wording' where id=$1", [
    requirement.id,
  ]);
  await db.query("update public.opportunities set title='Later title' where id=$1", [original.id]);
  assert.deepEqual(
    await row(
      'select review_snapshot,opportunity_snapshot from public.pursuit_decision_history where id=$1',
      [saved.id],
    ),
    { review_snapshot: saved.review_snapshot, opportunity_snapshot: saved.opportunity_snapshot },
  );
  step = 'notice matching and mobile human assessment';
  await owner.page.goto(url);
  const panel = owner.page.getByRole('region', { name: 'Similar past no-bid decisions' });
  await expect(panel).toContainText('Same agency: example city');
  const stalePage = await owner.page.context().newPage();
  await stalePage.goto(url);
  const assessment = (page) =>
    page
      .locator('details')
      .filter({ has: page.locator('summary').filter({ hasText: /^Bond capacity —/ }) });
  async function fillAssessment(page) {
    const form = assessment(page);
    await form.locator('summary').click();
    await form.getByLabel('Current status').selectOption('resolved');
    await form
      .getByLabel('What did you check?')
      .fill('Fictional new bonding letter checked by human.');
    await form.getByLabel('Supporting record or source reference').fill('Synthetic reference B-1');
    await form.getByRole('checkbox').check();
    return form;
  }
  const staleForm = await fillAssessment(stalePage);
  await owner.page.setViewportSize({ width: 390, height: 844 });
  const form = await fillAssessment(owner.page);
  assert(await owner.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await owner.page.screenshot({ path: '.tmp/decision-memory-staging-mobile.png', fullPage: true });
  await form.getByRole('button', { name: 'Record human assessment' }).click();
  await expect(
    panel.locator('summary').filter({ hasText: 'Bond capacity — Resolved for this notice' }),
  ).toBeVisible();
  await expect(
    panel.locator('summary').filter({ hasText: 'Job walk / pre-bid conflict — Needs review' }),
  ).toBeVisible();
  step = 'concurrent stale assessment rejected';
  await staleForm.getByRole('button', { name: 'Record human assessment' }).click();
  await expect(staleForm.getByRole('status')).not.toBeEmpty();
  assert.equal(
    (
      await row(
        'select count(*)::int n from public.decision_memory_reviews where organization_id=$1',
        [org],
      )
    ).n,
    1,
  );
  assert.equal(
    (await row('select requirement from public.pursuit_requirements where id=$1', [requirement.id]))
      .requirement,
    'Later wording',
  );
  step = 'viewer and cross-tenant API restrictions';
  await viewer.page.goto(url);
  await expect(
    viewer.page.getByRole('region', { name: 'Similar past no-bid decisions' }),
  ).toContainText('Fictional C-10 lighting');
  assert.equal(
    await viewer.page.getByRole('button', { name: 'Record human assessment' }).count(),
    0,
  );
  const denied = await foreign.client.rpc('similar_no_bid_decisions', { org, target: target.id });
  assert(denied.error, 'Cross-company RPC must deny access');
  const hidden = await foreign.client
    .from('pursuit_decision_history')
    .select('id')
    .eq('organization_id', org);
  assert(!hidden.error);
  assert.deepEqual(hidden.data, []);
  const review = await row(
    'select * from public.decision_memory_reviews where organization_id=$1',
    [org],
  );
  const viewerWrite = await viewer.client.rpc('review_decision_memory', {
    org,
    decision: saved.id,
    target: target.id,
    reason: 'bond',
    outcome: 'resolved',
    explanation: 'Forbidden viewer edit',
    reference: 'Fictional',
    expected_context: review.context_token,
    expected_previous: review.id,
  });
  assert(viewerWrite.error, 'Viewer must not assess');
  step = 'changed notice makes assessment stale';
  await db.query(
    "update public.opportunities set summary='Changed bond threshold and job walk' where id=$1",
    [target.id],
  );
  await owner.page.reload();
  await expect(
    panel.locator('summary').filter({ hasText: 'Bond capacity — Needs review' }),
  ).toBeVisible();
  step = 'search and pagination';
  // Additional fictional history records test bounded paging, not customer decisions.
  await db.query(
    "insert into public.pursuit_decision_history(organization_id,pursuit_id,decision,reason,conditions,context_token,decided_by,reason_codes) select $1,$2,'no_bid','Fictional paging record '||n,'','synthetic',$3,array['bond'] from generate_series(1,26) n",
    [org, pursuit.id, owner.id],
  );
  await owner.page.setViewportSize({ width: 1440, height: 1000 });
  await owner.page.goto(base + '/company?organization=' + org + '#company-decisions');
  await expect(log.locator('article')).toHaveCount(25);
  await log.getByRole('link', { name: 'Older decisions' }).click();
  await expect(log.locator('article')).toHaveCount(2);
  await log.getByRole('link', { name: 'Previous decisions' }).click();
  await expect(log.locator('article')).toHaveCount(25);
  await log.getByLabel('Search agency, notice title or rationale').fill('capacity and meeting');
  await log.getByRole('button', { name: 'Search history' }).click();
  await expect(log.locator('article')).toHaveCount(1);
  await expect(log).toContainText('Fictional C-10 lighting');
  await owner.page.screenshot({ path: '.tmp/decision-memory-staging-desktop.png', fullPage: true });
  console.log(
    'PASS hosted staging: sign-off, no-bid reasons, frozen history, matching, human assessment, concurrency, viewer/cross-tenant denial, staleness, search, pagination, desktop/mobile.',
  );
} catch (error) {
  if (activePage && !activePage.url().includes('/auth/callback'))
    await activePage
      .screenshot({ path: '.tmp/decision-memory-staging-failure.png', fullPage: true })
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
      "update public.organizations set status='suspended' where id=$1 and operating_name='Synthetic Decision Memory'",
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
