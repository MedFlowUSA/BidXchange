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
      'select id,verification_status,value from public.profile_facts where organization_id=$1',
      [org],
    )
  ).rows[0];
  assert.match(fact.value, /Synthetic Onboarding Contractor LLC/);
  assert.notEqual(fact.verification_status, 'verified');
  step = 'Passport recognition, collapsed evidence and direct record links';
  await owner.page.goto(base + '/onboarding?organization=' + org);
  await expect(owner.page.getByText(/1 related records saved/)).toBeVisible();
  await owner.page.goto(base + '/company?organization=' + org);
  await expect(owner.page.getByRole('progressbar', { name: 'Level-1 profile fields recorded' })).toHaveAttribute('max', '60');
  await expect(owner.page.getByRole('progressbar', { name: 'Level-1 profile fields recorded' })).toHaveAttribute('value', '2');
  const completion = owner.page.getByRole('region', { name: 'Level-1 profile completion: 3%' });
  await completion.locator('summary').filter({ hasText: /^Who is bidding/ }).click();
  await expect(completion.getByText('To add: Entity type', { exact: true })).toBeVisible();
  await owner.page.setViewportSize({ width: 390, height: 844 });
  assert(await owner.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await owner.page.screenshot({ path: '.tmp/profile-completion-mobile.png', fullPage: true });
  await owner.page.setViewportSize({ width: 1440, height: 1000 });
  await expect(owner.page.locator('#fact-' + fact.id)).not.toBeVisible();
  await owner.page.goto(base + '/company?organization=' + org + '#fact-' + fact.id);
  await expect(owner.page.locator('#fact-' + fact.id)).toBeVisible();
  await expect(owner.page.locator('#fact-' + fact.id)).toHaveJSProperty('open', true);
  await owner.page
    .getByLabel('Search saved evidence', { exact: true })
    .fill('no matching synthetic record');
  await expect(owner.page.locator('#fact-' + fact.id)).toHaveCount(0);
  await owner.page.getByLabel('Search saved evidence', { exact: true }).fill('Legal business name');
  await expect(owner.page.locator('#fact-' + fact.id)).toBeVisible();
  await owner.page.goto(base + '/pursuits?organization=' + org);
  await expect(
    owner.page.getByRole('link', { name: 'Record or choose an opportunity' }),
  ).toBeVisible();
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
    has: owner.page
      .locator('summary')
      .filter({ hasText: /^Open this pursuit’s workflow checklist$/ }),
  });
  await checklist.locator('summary').click();
  await checklist
    .getByRole('link', { name: 'Sign off the Requirements Register', exact: true })
    .click();
  await expect(owner.page).toHaveURL(/#register-signoff$/);
  await expect(owner.page.locator('#register-signoff')).toContainText('Human sign-off is required');
  step = 'requirement correction: create source and target';
  const pursuitId = new URL(owner.page.url()).pathname.split('/').pop();
  for (const wording of ['Synthetic original form', 'Synthetic duplicate form']) {
    const addRequirement = owner.page.getByRole('group', { name: 'Add requirement', exact: true });
    await addRequirement.locator('summary').click();
    await addRequirement.getByLabel('Requirement text', { exact: true }).fill(wording);
    await addRequirement
      .getByLabel('Notice citation', { exact: true })
      .fill('Training notice section ' + wording);
    await addRequirement.getByRole('button', { name: 'Add requirement', exact: true }).click();
    await expect(addRequirement.getByRole('status')).toContainText('Requirement saved');
    await owner.page.reload();
  }
  const requirementRows = (
    await db.query(
      'select id,requirement from public.pursuit_requirements where organization_id=$1 and pursuit_id=$2 order by requirement',
      [org, pursuitId],
    )
  ).rows;
  const sourceId = requirementRows.find((r) => r.requirement === 'Synthetic original form').id;
  const targetId = requirementRows.find((r) => r.requirement === 'Synthetic duplicate form').id;
  step = 'archive source on mobile';
  await owner.page.setViewportSize({ width: 390, height: 844 });
  let sourceRow = owner.page.locator('#requirement-' + sourceId);
  await sourceRow
    .locator('summary')
    .filter({ hasText: /^Archive or merge requirement$/ })
    .click();
  let correction = sourceRow.getByRole('form', { name: 'Correct requirement', exact: true });
  await correction
    .getByLabel('Correction reason', { exact: true })
    .fill('Synthetic duplicate needs review');
  await correction.getByRole('checkbox').check();
  await correction.getByRole('button', { name: 'Archive requirement', exact: true }).click();
  await expect(
    owner.page
      .getByRole('region', { name: 'Archived requirements and correction history' })
      .locator('summary')
      .filter({ hasText: /^Synthetic original form$/ }),
  ).toBeVisible();
  await owner.page.reload();
  step = 'restore original source';
  const archivedRow = owner.page
    .getByRole('region', { name: 'Archived requirements and correction history' })
    .locator('details.panel')
    .filter({ hasText: 'Synthetic original form' });
  await archivedRow.locator('summary').first().click();
  await archivedRow
    .locator('summary')
    .filter({ hasText: /^Restore requirement$/ })
    .click();
  const restore = archivedRow.getByRole('form', { name: 'Restore requirement', exact: true });
  await restore
    .getByLabel('Correction reason', { exact: true })
    .fill('Restore to compare the source wording');
  await restore.getByRole('checkbox').check();
  await restore.getByRole('button', { name: 'Restore requirement for review' }).click();
  await expect(
    owner.page
      .locator('#requirement-' + sourceId)
      .getByRole('heading', { name: 'Synthetic original form', exact: true }),
  ).toBeVisible();
  await owner.page.reload();
  step = 'merge duplicate on desktop';
  await owner.page.setViewportSize({ width: 1440, height: 1000 });
  sourceRow = owner.page.locator('#requirement-' + sourceId);
  await sourceRow
    .locator('summary')
    .filter({ hasText: /^Archive or merge requirement$/ })
    .click();
  correction = sourceRow.getByRole('form', { name: 'Correct requirement', exact: true });
  await correction.getByLabel('Correction action', { exact: true }).selectOption('merge');
  await correction
    .getByLabel('Keep this target requirement', { exact: true })
    .selectOption(targetId);
  await correction
    .getByLabel('Combined requirement wording', { exact: true })
    .fill('Synthetic combined form instructions');
  await correction
    .getByLabel('Correction reason', { exact: true })
    .fill('Two references describe the same training form');
  await correction.getByRole('checkbox').check();
  await correction.getByRole('button', { name: 'Merge requirements', exact: true }).click();
  await expect(owner.page.locator('#requirement-' + targetId)).toContainText(
    'Synthetic combined form instructions',
  );
  await owner.page.reload();
  await expect(owner.page.locator('#requirement-' + targetId)).toContainText(
    'Synthetic combined form instructions',
  );
  const lifecycle = (
    await db.query(
      'select action,recorded_by from public.requirement_lifecycle_history where organization_id=$1 and pursuit_id=$2 order by sequence',
      [org, pursuitId],
    )
  ).rows;
  assert.deepEqual(
    lifecycle.map((r) => r.action),
    ['archive', 'restore', 'merge'],
  );
  assert(lifecycle.every((r) => r.recorded_by === owner.id));
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
