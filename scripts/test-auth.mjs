import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import { connectDatabase } from './db.mjs';

const base = process.env.TEST_APP_URL ?? 'http://127.0.0.1:3000';
const project = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const keys = JSON.parse(
  execFileSync('supabase', ['projects', 'api-keys', '--project-ref', project, '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
const auth = createClient(
  `https://${project}.supabase.co`,
  keys.find((k) => k.name === 'service_role').api_key,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const db = await connectDatabase();
const users = [];
const orgs = [];
const fixtures = [];
let browser;
let checks = 0;
const check = (condition, description) => {
  assert.ok(condition, description);
  checks++;
  console.log('PASS ' + description);
};
try {
  for (let i = 0; i < 2; i++) {
    const email = `bidxchange-test-${randomUUID()}@example.invalid`;
    const created = await auth.auth.admin.createUser({ email, email_confirm: false });
    if (created.error) throw new Error('Fixture account creation failed');
    users.push(created.data.user.id);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Fictional Auth Test',$1,$2) returning id",
        [`Auth Fixture ${i + 1}`, `auth-fixture-${randomUUID()}`],
      )
    ).rows[0].id;
    orgs.push(org);
    await db.query(
      'insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,$3)',
      [org, users[i], 'viewer'],
    );
    const profile = (
      await db.query(
        'insert into public.company_profiles(organization_id) values($1) returning id',
        [org],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.profile_facts(organization_id,company_profile_id,fact_type,label,value,verification_status,source_note) values($1,$2,'test','Fictional license','TEST-ONLY','pending_verification','Synthetic test data')",
      [org, profile],
    );
    const opp = (
      await db.query(
        "insert into public.opportunities(organization_id,title,buyer,source_note) values($1,$2,'Fictional buyer','Synthetic test source') returning id",
        [org, `Private opportunity ${i + 1}`],
      )
    ).rows[0].id;
    const pursuit = (
      await db.query(
        'insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,$3) returning id',
        [org, opp, `Private pursuit ${i + 1}`],
      )
    ).rows[0].id;
    fixtures.push({ email, org, opp, pursuit });
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const contexts = [];
  for (const f of fixtures) {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const generated = await auth.auth.admin.generateLink({ type: 'magiclink', email: f.email });
    if (generated.error) throw new Error('Test link generation failed');
    // No email is sent and neither the one-use hash nor session cookies are printed or saved.
    if (f === fixtures[0]) {
      await page.goto(
        `${base}/auth/callback?token_hash=${generated.data.properties.hashed_token}&next=/dashboard`,
      );
    } else {
      await page.goto(`${base}/login`);
      await page.getByText('Use a one-time email code', { exact: true }).click();
      await page.locator('.code-signin').getByLabel('Email address').fill(f.email);
      await page
        .getByLabel('One-time code', { exact: true })
        .fill(generated.data.properties.email_otp);
      await page.getByRole('button', { name: 'Verify code', exact: true }).click();
    }
    await page.getByRole('heading', { name: 'Your workspace starts with the facts.' }).waitFor();
    check(
      (await context.cookies()).some((c) => c.name.includes('auth-token') && c.httpOnly),
      'Passwordless callback creates HttpOnly session',
    );
    await page.goto(base + '/');
    await page.getByRole('heading', { level: 1, name: /Stop Searching/ }).waitFor();
    check(
      !(await page.locator('body').innerText()).includes('Auth Fixture'),
      'Public homepage does not disclose tenant identity',
    );
    await page.getByRole('link', { name: 'Open Workspace', exact: true }).click();
    await page.getByRole('heading', { name: 'Your workspace starts with the facts.' }).waitFor();
    check(true, 'Signed-in homepage entry reaches the authorized workspace');
    await page.goto(`${base}/opportunities/${f.opp}?organization=${f.org}`);
    await page.getByRole('heading', { name: 'Scope', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Scope', exact: true }).waitFor();
    check(
      (await page.locator('body').innerText()).includes('Synthetic test source'),
      'Authenticated direct opportunity URL survives refresh',
    );
    await page.goto(`${base}/pursuits/${f.pursuit}?organization=${f.org}`);
    await page.getByRole('heading', { name: 'Compliance matrix', exact: true }).waitFor();
    check(true, 'Authenticated pursuit foundation renders');
    await page.goto(`${base}/company?organization=${f.org}`);
    await page.getByRole('heading', { name: 'Fictional license', exact: true }).waitFor();
    check(
      !(await page.locator('main').innerText()).includes('Apex Energy'),
      'Demo credentials do not appear in authenticated company',
    );
  }
  const page = contexts[0].pages()[0];
  const f = fixtures[0];
  await page.goto(`${base}/dashboard?workspace=demo`);
  await page.getByRole('button', { name: 'Switch workspace' }).click();
  check(
    !(await page.getByRole('dialog').innerText()).includes('Green Energy Solutions'),
    'Unauthorized GES is absent from authenticated selector',
  );
  await page
    .getByRole('dialog')
    .getByRole('link', { name: /Auth Fixture 1/ })
    .click();
  await page.getByRole('heading', { name: 'Your workspace starts with the facts.' }).waitFor();
  check(
    !(await page.locator('main').innerText()).includes('Municipal building energy retrofit'),
    'Organization switch does not copy demo opportunities',
  );
  await page.goto(`${base}/opportunities/${fixtures[1].opp}?organization=${fixtures[1].org}`);
  await page.getByRole('heading', { name: 'Record not found or access denied.' }).waitFor();
  check(true, 'Guessed other-tenant URL renders access-denied state');
  check(
    !(await page.locator('body').innerText()).includes('Private opportunity 2'),
    'Other tenant content is not disclosed',
  );
  const viewer = contexts[1].pages()[0];
  await viewer.goto(`${base}/settings?organization=${fixtures[1].org}`);
  await viewer.getByRole('heading', { name: 'Organization profile', exact: true }).waitFor();
  check(
    (await viewer.getByRole('button', { name: 'Save organization', exact: true }).count()) === 0,
    'Viewer has no administrator controls',
  );
  await viewer.getByRole('button', { name: 'Sign out', exact: true }).click();
  await viewer.waitForURL(/\/login/);
  await viewer.goto(`${base}/settings?organization=${fixtures[1].org}`);
  await viewer.waitForURL(/\/login\?next=/);
  check(true, 'Sign-out removes access to protected routes');
  console.log(`Authenticated browser suite passed: ${checks} checks.`);
} catch (error) {
  console.error(String(error.message).replace(/(token_hash|code)=[^\s&"']+/g, '$1=<redacted>'));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  // Cleanup is confined to explicit generated fixture UUIDs. Triggers remain enabled.
  if (orgs.length) {
    await db.query('begin');
    try {
      const tables = (
        await db.query(
          "select table_name from information_schema.columns where table_schema='public' and column_name='organization_id' order by case when table_name like 'pursuit_%' or table_name in ('proposal_sections','submission_records') then 0 when table_name='pursuits' then 1 when table_name='profile_facts' then 3 when table_name='company_profiles' then 4 when table_name='organization_memberships' then 5 when table_name='audit_events' then 6 else 2 end",
        )
      ).rows;
      for (const { table_name } of tables)
        await db.query(`delete from public.${table_name} where organization_id=any($1::uuid[])`, [
          orgs,
        ]);
      await db.query('delete from public.organizations where id=any($1::uuid[])', [orgs]);
      await db.query('delete from private.admin_mutation_limits where user_id=any($1::uuid[])', [
        users,
      ]);
      await db.query('commit');
    } catch (e) {
      await db.query('rollback');
      throw e;
    }
  }
  for (const id of users) {
    const result = await auth.auth.admin.deleteUser(id);
    if (result.error) throw new Error('Fixture user cleanup failed');
  }
  await db.end();
  console.log('Disposable authentication fixtures removed.');
}
