import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { chromium, expect } from '@playwright/test';
import { stagingDatabase, stagingKeys, stagingRef } from './connection.mjs';
const base = process.argv[2];
assert(
  /^https:\/\/bidxchange-[a-z0-9]+-manuel-rodriguezs-projects-f5946c44\.vercel\.app$/.test(base),
);
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
const label = `Synthetic capture ${randomUUID()}`;
let user, browser;
try {
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
  assert(bypass);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
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
    ...[...cookies.values()].map((c) => ({
      name: c.name,
      value: c.value,
      url: base,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    })),
  ]);
  const page = await context.newPage();
  const open = async (page, label) => {
    await page.locator(`details[aria-label="${label}"] > summary`).first().click();
    return page.locator(`form[aria-label="${label}"]`).first();
  };
  const save = async (form, label, message) => {
    await form.getByRole('button', { name: label, exact: true }).click();
    await expect(form.getByRole('status')).toContainText(message, { timeout: 20000 });
  };
  await db.query(
    "update public.organization_memberships set role='capture_manager' where organization_id=$1 and user_id=$2",
    [org, user],
  );
  await page.goto(`${base}/opportunities?organization=${org}`);
  let form = await open(page, 'Add opportunity');
  await form.getByLabel('Opportunity title', { exact: true }).fill(label);
  await form.getByLabel('Buyer', { exact: true }).fill('Synthetic buyer');
  await form.getByLabel('Source URL', { exact: true }).fill('https://example.invalid/notice');
  await form
    .getByLabel('Official deadline with offset', { exact: true })
    .fill('2026-10-15T14:00:00-07:00');
  await save(form, 'Add opportunity', 'Opportunity saved');
  const getOpportunity = async () =>
    (
      await db.query('select * from public.opportunities where organization_id=$1 and title=$2', [
        org,
        label,
      ])
    ).rows[0];
  const opportunity = await getOpportunity();
  assert(opportunity);
  assert.equal(opportunity.official_deadline.toISOString(), '2026-10-15T21:00:00.000Z');
  const detail = `${base}/opportunities/${opportunity.id}?organization=${org}`;
  await page.goto(detail);
  await expect(page.getByText('Synthetic buyer', { exact: true })).toBeVisible();
  const stale = await context.newPage();
  await stale.goto(detail);
  const staleForm = await open(stale, 'Edit opportunity');
  await staleForm.getByLabel('Buyer', { exact: true }).fill('Stale buyer');
  form = await open(page, 'Edit opportunity');
  await form.getByLabel('Buyer', { exact: true }).fill('Corrected buyer');
  await save(form, 'Edit opportunity', 'Opportunity saved');
  await save(staleForm, 'Edit opportunity', 'record changed');
  await expect(staleForm.getByLabel('Buyer', { exact: true })).toHaveValue('Stale buyer');
  assert.equal((await getOpportunity()).buyer, 'Corrected buyer');
  console.log('PASS capture manager saves source and deadline; stale edits cannot overwrite');
  form = await open(page, 'Create planning workspace');
  await form.getByRole('button', { name: 'Create planning workspace', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Open pursuit: ' + label, exact: false }),
  ).toBeVisible({ timeout: 20000 });
  const pursuit = (
    await db.query('select * from public.pursuits where organization_id=$1 and opportunity_id=$2', [
      org,
      opportunity.id,
    ])
  ).rows[0];
  assert(pursuit);
  assert.equal(pursuit.decision, 'pending');
  assert.equal(pursuit.decided_by, null);
  const pursuitUrl = `${base}/pursuits/${pursuit.id}?organization=${org}`;
  await page.goto(pursuitUrl);
  form = await open(page, 'Add task');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await form.getByLabel('Task title', { exact: true }).fill(label);
  await form.getByLabel('Task owner', { exact: true }).selectOption(user);
  await form
    .getByLabel('Task deadline with offset', { exact: true })
    .fill('2026-10-10T12:00:00-07:00');
  await save(form, 'Add task', 'Task saved');
  const getTask = async () =>
    (
      await db.query(
        'select * from public.pursuit_tasks where organization_id=$1 and pursuit_id=$2 and title=$3',
        [org, pursuit.id, label],
      )
    ).rows[0];
  assert.equal((await getTask()).assigned_user_id, user);
  await page.reload();
  await stale.goto(pursuitUrl);
  const staleTask = await open(stale, 'Edit task');
  await staleTask.getByLabel('Task title', { exact: true }).fill('Stale task must not win');
  form = await open(page, 'Edit task');
  await form.getByLabel('Task status', { exact: true }).selectOption('complete');
  await save(form, 'Edit task', 'Task saved');
  assert.equal((await getTask()).status, 'complete');
  await save(staleTask, 'Edit task', 'record changed');
  assert.equal((await getTask()).title, label);
  assert((await client.from('pursuits').update({ decision: 'bid' }).eq('id', pursuit.id)).error);
  console.log(
    'PASS pending pursuit links to source; assigned tasks persist and complete; stale edits and bid authorization rejected',
  );
  await page.reload();
  form = await open(page, 'Add requirement');
  await form.getByLabel('Requirement text', { exact: true }).fill('Synthetic bid bond requirement');
  await form
    .getByLabel('Notice citation', { exact: true })
    .fill('Synthetic notice section 4.2, page 18');
  await form.getByLabel('Requirement owner', { exact: true }).selectOption(user);
  await form.getByLabel('Follow-up status', { exact: true }).selectOption('missing_information');
  await save(form, 'Add requirement', 'Requirement saved');
  const getRequirement = async () =>
    (
      await db.query(
        'select * from public.pursuit_requirements where organization_id=$1 and pursuit_id=$2',
        [org, pursuit.id],
      )
    ).rows[0];
  const requirement = await getRequirement();
  assert(requirement);
  assert.equal(requirement.owner_user_id, user);
  assert.equal(requirement.status, 'missing_information');
  await page.reload();
  await expect(page.locator(`#requirement-${requirement.id}`)).toContainText(
    'Synthetic notice section 4.2, page 18',
  );
  await stale.reload();
  const staleRequirement = await open(stale, 'Edit requirement');
  await staleRequirement
    .getByLabel('Requirement text', { exact: true })
    .fill('Stale requirement must not win');
  form = await open(page, 'Edit requirement');
  await form.getByLabel('Follow-up status', { exact: true }).selectOption('blocked');
  await save(form, 'Edit requirement', 'Requirement saved');
  const refreshForm = await open(stale, 'Add task');
  await refreshForm.getByLabel('Task title', { exact: true }).fill('Synthetic refresh task');
  await save(refreshForm, 'Add task', 'Task saved');
  await save(staleRequirement, 'Edit requirement', 'record changed');
  await expect(staleRequirement.getByLabel('Requirement text', { exact: true })).toHaveValue(
    'Stale requirement must not win',
  );
  assert.equal((await getRequirement()).status, 'blocked');
  assert.equal((await getRequirement()).requirement, 'Synthetic bid bond requirement');
  form = await open(page, 'Add requirement');
  await form.getByLabel('Requirement text', { exact: true }).fill('Rejected owner');
  await form.getByLabel('Notice citation', { exact: true }).fill('Synthetic citation');
  const foreignOwner = randomUUID();
  await form
    .getByLabel('Requirement owner', { exact: true })
    .evaluate(
      (element, value) => element.add(new Option('Unavailable owner', value)),
      foreignOwner,
    );
  await form.getByLabel('Requirement owner', { exact: true }).selectOption(foreignOwner);
  await save(form, 'Add requirement', 'Choose an active organization member');
  await form.getByLabel('Requirement owner', { exact: true }).selectOption(user);
  await form.locator('input[name="pursuit_id"]').evaluate((element, value) => {
    element.value = value;
  }, randomUUID());
  await save(form, 'Add requirement', 'Could not save');
  assert.equal(
    (
      await db.query(
        'select count(*)::int as n from public.pursuit_requirements where organization_id=$1 and pursuit_id=$2',
        [org, pursuit.id],
      )
    ).rows[0].n,
    1,
  );
  await db.query("update public.pursuit_requirements set status='compliant' where id=$1", [
    requirement.id,
  ]);
  await page.reload();
  await expect(page.locator(`#requirement-${requirement.id}`)).toContainText(
    'Follow-up: Needs review',
  );
  await expect(page.locator(`#requirement-${requirement.id}`)).not.toContainText('compliant');
  console.log(
    'PASS cited requirements persist with owners; stale edits, invalid owners and unavailable parents rejected; arbitrary legacy status cannot claim compliance',
  );
  await open(stale, 'Edit task');
  await db.query(
    "update public.organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",
    [org, user],
  );
  await save(staleTask, 'Edit task', 'Check capture access');
  await save(staleRequirement, 'Edit requirement', 'Check capture access');
  await page.reload();
  await expect(page.locator('details[aria-label="Add requirement"]')).toHaveCount(0);
  await expect(page.locator('details[aria-label="Edit requirement"]')).toHaveCount(0);
  await expect(page.locator(`#requirement-${requirement.id}`)).toBeVisible();
  assert(
    (
      await client
        .from('pursuit_requirements')
        .insert({ organization_id: org, pursuit_id: pursuit.id, requirement: 'forbidden' })
    ).error,
  );
  await expect(page.locator('details[aria-label="Add task"]')).toHaveCount(0);
  await expect(page.locator('details[aria-label="Edit task"]')).toHaveCount(0);
  assert((await client.from('opportunities').insert({ organization_id: org, title: label })).error);
  assert(
    (
      await client
        .from('pursuit_tasks')
        .insert({ organization_id: org, pursuit_id: pursuit.id, title: label })
    ).error,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log(
    'PASS revoked capture access rejected; viewer writes denied and controls hidden; mobile contained',
  );
} finally {
  if (browser) await browser.close();
  await db.query(
    'delete from public.pursuit_requirements where organization_id=$1 and pursuit_id in (select p.id from public.pursuits p join public.opportunities o on o.id=p.opportunity_id and o.organization_id=p.organization_id where o.organization_id=$1 and o.title=$2)',
    [org, label],
  );
  await db.query(
    'delete from public.pursuit_tasks where organization_id=$1 and pursuit_id in (select p.id from public.pursuits p join public.opportunities o on o.id=p.opportunity_id and o.organization_id=p.organization_id where o.organization_id=$1 and o.title=$2)',
    [org, label],
  );
  await db.query(
    'delete from public.pursuits where organization_id=$1 and opportunity_id in (select id from public.opportunities where organization_id=$1 and title=$2)',
    [org, label],
  );
  await db.query('delete from public.opportunities where organization_id=$1 and title=$2', [
    org,
    label,
  ]);
  if (user)
    await db.query(
      'delete from public.organization_memberships where organization_id=$1 and user_id=$2',
      [org, user],
    );
  await db.query("update public.organizations set status='suspended' where id=$1", [org]);
  if (user) assert(!(await admin.auth.admin.deleteUser(user)).error);
  await db.end();
  console.log('Synthetic capture records and account removed; fixture suspended again.');
}
