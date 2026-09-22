// Real hosted authentication/database, local application. No email is sent.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect as baseExpect } from '@playwright/test';
import { stagingKeys, stagingRef, stagingDatabase } from './connection.mjs';
const base = 'http://127.0.0.1:3106';
const expect = baseExpect.configure({ timeout: 20000 });
const keys = stagingKeys(),
  db = await stagingDatabase();
const auth = createClient(`https://${stagingRef}.supabase.co`, keys.service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const users = [];
let org,
  browser,
  activePage,
  step = 'startup';
const server = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'dev',
    'apps/web',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3106',
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
      BIDXCHANGE_SELF_SERVICE_ENABLED: 'true',
      BIDXCHANGE_EVIDENCE_MONITOR_ENABLED: 'true',
      BIDXCHANGE_STRUCTURED_PROFILES_ENABLED: 'true',
      BIDXCHANGE_CONTRACTOR_WORKFLOW_ENABLED: 'true',
      BIDXCHANGE_REGISTER_SIGNOFF_ENABLED: 'true',
      BIDXCHANGE_RELEASES_ENABLED: 'true',
      BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED: 'true',
      BIDXCHANGE_DECISIONS_ENABLED: 'true',
      BIDXCHANGE_RESOLUTIONS_ENABLED: 'true',
      BIDXCHANGE_AI_ENABLED: 'false',
    },
  },
);
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
  assert(ready);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  async function account() {
    const email = `onboarding-${randomUUID()}@example.invalid`;
    const generated = await auth.auth.admin.generateLink({
      type: 'signup',
      email,
      password: randomBytes(32).toString('base64url'),
    });
    assert(!generated.error);
    users.push(generated.data.user.id);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    // Consume the same callback as an emailed confirmation link, without sending email.
    await page.goto(
      base +
        '/auth/callback?token_hash=' +
        encodeURIComponent(generated.data.properties.hashed_token) +
        '&next=%2Fonboarding',
    );
    await expect(page.getByRole('heading', { name: 'Create or join a company' })).toBeVisible();
    return { page, email, id: generated.data.user.id };
  }
  step = 'verified signup and company creation';
  const owner = await account();
  activePage = owner.page;
  step = 'company creation';
  await owner.page.getByLabel('Legal company name').fill('Synthetic Onboarding Contractor LLC');
  await owner.page.getByLabel('Operating name / DBA').fill('Synthetic Onboarding Contractor');
  await owner.page.getByRole('button', { name: 'Create company workspace' }).click();
  await expect(owner.page).toHaveURL(/onboarding\?organization=/);
  org = new URL(owner.page.url()).searchParams.get('organization');
  assert.match(org, /^[a-f0-9-]{36}$/);
  await expect(owner.page.getByRole('link', { name: 'Who is bidding?' })).toBeVisible();
  await owner.page.getByRole('link', { name: 'Who is bidding?' }).click();
  step = 'first Passport evidence';
  const editor = owner.page.getByRole('group', { name: 'Add Legal business name', exact: true });
  await editor.locator('summary').click();
  await editor
    .getByLabel('Legal business name', { exact: true })
    .fill('Synthetic Onboarding Contractor LLC');
  await editor
    .getByLabel('Evidence reference', { exact: true })
    .fill('Fictional training identity; not a real contractor');
  await editor.getByRole('button', { name: 'Save evidence record', exact: true }).click();
  await expect(owner.page.locator('#passport-identity')).toContainText('1 related saved record', {
    timeout: 15000,
  });
  const fact = (
    await db.query(
      'select verification_status,value from public.profile_facts where organization_id=$1',
      [org],
    )
  ).rows[0];
  assert.match(fact.value, /Synthetic Onboarding Contractor LLC/);
  assert.notEqual(fact.verification_status, 'verified');
  step = 'scheduled evidence reminder and real acknowledgement';
  await db.query(
    'update public.profile_facts set expiration_date=current_date-1 where organization_id=$1',
    [org],
  );
  await db.query('select private.monitor_organization_evidence($1)', [org]);
  await owner.page.goto(base + '/dashboard?organization=' + org);
  const reminders = owner.page.getByRole('region', { name: 'Evidence reminders' });
  await expect(reminders).toContainText('Evidence expired');
  await reminders.getByRole('button', { name: 'Acknowledge reminder' }).click();
  await expect(reminders).toContainText('Acknowledged; evidence still needs review.');
  assert(
    (
      await db.query(
        'select acknowledged_at from public.evidence_reminders where organization_id=$1',
        [org],
      )
    ).rows[0].acknowledged_at,
  );
  step = 'first opportunity and pursuit';
  await owner.page.goto(base + '/opportunities?organization=' + org);
  const add = owner.page
    .locator('details')
    .filter({ has: owner.page.locator('summary').filter({ hasText: /^Add opportunity$/ }) });
  await add.locator('summary').click();
  await add
    .getByLabel('Opportunity title', { exact: true })
    .fill('Synthetic school lighting retrofit');
  await add.getByLabel('Buyer', { exact: true }).fill('Fictional School District');
  await add
    .getByLabel('Source note', { exact: true })
    .fill('Fictional notice for onboarding validation only');
  await add.getByRole('button', { name: 'Add opportunity', exact: true }).click();
  await add.getByRole('link', { name: 'Open workspace record' }).click();
  const planning = owner.page.locator('details').filter({
    has: owner.page.locator('summary').filter({ hasText: /^Create planning workspace$/ }),
  });
  await planning.locator('summary').click();
  await planning.getByRole('button', { name: 'Create planning workspace', exact: true }).click();
  await owner.page
    .getByRole('link', { name: 'Open pursuit: Synthetic school lighting retrofit →', exact: true })
    .click();
  await expect(owner.page).toHaveURL(/\/pursuits\//);
  step = 'pursuit checklist and sign-off navigation';
  await expect(owner.page.getByText('Planned pursuit tools', { exact: true })).toHaveCount(0);
  const checklist = owner.page.locator('details').filter({
    has: owner.page.locator('summary').filter({ hasText: /^Open this pursuit’s workflow checklist$/ }),
  });
  await checklist.locator('summary').click();
  await checklist.getByRole('link', { name: 'Sign off the Requirements Register', exact: true }).click();
  await expect(owner.page).toHaveURL(/#register-signoff$/);
  await expect(owner.page.locator('#register-signoff')).toContainText('Human sign-off is required');
  step = 'invitation creation';
  const colleague = await account();
  await owner.page.goto(base + '/settings/team?organization=' + org);
  await owner.page.getByLabel('Colleague’s work email').fill(colleague.email);
  await owner.page.getByLabel('Workspace role').selectOption('viewer');
  await owner.page.getByRole('button', { name: 'Create invitation', exact: true }).click();
  await expect(owner.page.getByRole('status').first()).toContainText('Invitation created');
  step = 'named recipient acceptance';
  await colleague.page.reload();
  await colleague.page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await expect(colleague.page).toHaveURL(/dashboard\?organization=/);
  assert.equal(new URL(colleague.page.url()).searchParams.get('organization'), org);
  await colleague.page.goto(base + '/settings/team?organization=' + org);
  await expect(
    colleague.page.getByRole('heading', { name: 'Record not found or access denied.' }),
  ).toBeVisible();
  await owner.page.setViewportSize({ width: 390, height: 844 });
  await owner.page.goto(base + '/onboarding?organization=' + org);
  assert(await owner.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await owner.page.screenshot({ path: '.tmp/onboarding-staging-mobile.png', fullPage: true });
  await owner.page.setViewportSize({ width: 1440, height: 1000 });
  await owner.page.goto(base + '/settings/team?organization=' + org);
  await owner.page.screenshot({ path: '.tmp/onboarding-staging-team.png', fullPage: true });
  console.log(
    'PASS hosted staging: confirmation callback, company creation, Passport evidence, first opportunity/pursuit, invitation acceptance, viewer denial and mobile layout. No email sent.',
  );
} catch (error) {
  if (activePage && !activePage.url().includes('/auth/callback')) {
    await activePage
      .screenshot({ path: '.tmp/onboarding-staging-failure.png', fullPage: true })
      .catch(() => {});
  }
  console.error(
    String(error.message)
      .replace(/(token_hash|token|code)=[^&\s"']+/g, '$1=[redacted]')
      .slice(0, 1200),
  );
  console.error(
    'Hosted onboarding browser check failed at: ' + step + '. Session/provider details withheld.',
  );
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  // New synthetic workspace history is retained, suspended and inaccessible; never touch customer fixtures.
  if (org)
    await db.query(
      "update public.organizations set status='suspended' where id=$1 and operating_name='Synthetic Onboarding Contractor'",
      [org],
    );
  for (const id of users) {
    const result = await auth.auth.admin.updateUserById(id, { ban_duration: '876000h' });
    assert(!result.error);
  }
  await db.end();
  if (server.pid)
    try {
      execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {}
  console.log(
    'Synthetic staging accounts banned and workspace suspended; no production customer records used.',
  );
}
