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
const label = `Synthetic evidence ${randomUUID()}`;
let user, browser;
const priorProfile = (
  await db.query('select id from public.company_profiles where organization_id=$1', [org])
).rows[0]?.id;
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
  const page = await context.newPage(),
    company = `${base}/company?organization=${org}`;
  await page.goto(company);
  const form = page.locator('form[aria-label="Add identity evidence"]');
  await page.locator('details[aria-label="Add identity evidence"] > summary').click();
  await form.getByLabel('Record label', { exact: true }).fill(label);
  await form.getByLabel('Known information', { exact: true }).fill('Initial synthetic value');
  await form
    .getByLabel('Evidence reference', { exact: true })
    .fill('https://example.invalid/evidence');
  await expect(form.locator('select[name="sensitivity"]')).toHaveValue('restricted');
  await form.getByRole('button', { name: 'Save evidence record', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Saved for human review', {
    timeout: 20000,
  });
  const get = async () =>
    (
      await db.query('select * from public.profile_facts where organization_id=$1 and label=$2', [
        org,
        label,
      ])
    ).rows[0];
  const saved = await get();
  assert(saved);
  assert.equal(saved.owner_user_id, user);
  assert.equal(saved.verification_status, 'pending_verification');
  assert.equal(saved.sensitivity, 'restricted');
  await page.reload();
  let card = page.locator(`#fact-${saved.id}`);
  await expect(card).toContainText('Initial synthetic value');
  console.log(
    'PASS real administrator creates evidence with source, owner and restricted visibility; reload preserves it',
  );
  await card.locator('summary').filter({ hasText: 'Review verification' }).click();
  await card.locator('select[name="verification_status"]').selectOption('verified');
  await card.getByRole('button', { name: 'Save fact review', exact: true }).click();
  await expect.poll(async () => (await get()).verification_status).toBe('verified');
  assert.equal((await get()).verified_by, user);
  const stale = await context.newPage();
  await stale.goto(company);
  let staleCard = stale.locator(`#fact-${saved.id}`);
  await staleCard.locator('summary').filter({ hasText: 'Edit saved evidence' }).click();
  const staleForm = staleCard.locator(`form[aria-label="Edit ${label}"]`);
  await staleForm.getByLabel('Known information', { exact: true }).fill('Stale value must not win');
  await page.reload();
  card = page.locator(`#fact-${saved.id}`);
  await card.locator('summary').filter({ hasText: 'Edit saved evidence' }).click();
  const edit = card.locator(`form[aria-label="Edit ${label}"]`);
  await edit.getByLabel('Known information', { exact: true }).fill('Corrected synthetic value');
  await edit.getByLabel('Effective date', { exact: true }).fill('2026-09-01');
  await edit.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect.poll(async () => (await get()).value).toBe('Corrected synthetic value');
  assert.equal((await get()).verification_status, 'pending_verification');
  assert.equal((await get()).verified_by, null);
  assert.equal((await get()).verified_at, null);
  await staleForm.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(staleForm.getByRole('status')).toContainText('record changed');
  await expect(staleForm.getByLabel('Known information', { exact: true })).toHaveValue(
    'Stale value must not win',
  );
  assert.equal((await get()).value, 'Corrected synthetic value');
  console.log(
    'PASS human verification is stamped, corrections clear it, and stale edits retain entered text without overwriting',
  );
  await db.query(
    "update public.organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",
    [org, user],
  );
  await staleForm.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(staleForm.getByRole('status')).toContainText('administrator access');
  await page.reload();
  await expect(page.getByRole('heading', { name: label, exact: true })).toHaveCount(0);
  await expect(page.locator('.company-record-editor')).toHaveCount(0);
  assert(
    (
      await client.from('profile_facts').insert({
        organization_id: org,
        company_profile_id: saved.company_profile_id,
        fact_type: 'identity',
        label: 'forbidden',
      })
    ).error,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log(
    'PASS revoked administrator cannot save through the existing form; viewer cannot see restricted evidence or write directly',
  );
} finally {
  if (browser) await browser.close();
  await db.query('delete from public.profile_facts where organization_id=$1 and label=$2', [
    org,
    label,
  ]);
  if (user)
    await db.query(
      'delete from public.organization_memberships where organization_id=$1 and user_id=$2',
      [org, user],
    );
  if (!priorProfile)
    await db.query('delete from public.company_profiles where organization_id=$1', [org]);
  await db.query("update public.organizations set status='suspended' where id=$1", [org]);
  if (user) {
    const removed = await admin.auth.admin.deleteUser(user);
    assert(!removed.error);
  }
  await db.end();
  console.log('Synthetic evidence and account removed; existing synthetic shell suspended again.');
}
