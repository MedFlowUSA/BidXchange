import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { chromium, expect } from '@playwright/test';
import { stagingDatabase, stagingKeys, stagingRef } from './connection.mjs';
const base = process.argv[2];
assert.equal(base, 'http://127.0.0.1:3103');
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
const label = `Structured training ${randomUUID()}`;
let user, browser;
try {
  const email = `structured-${randomUUID()}@example.invalid`,
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
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    })),
  );
  const page = await context.newPage();
  await page.goto(`${base}/company?organization=${org}`);
  const editor = page.getByRole('group', { name: 'Add Business mailing address', exact: true });
  await editor.locator('summary').click();
  await editor.getByLabel('Record label', { exact: true }).fill(label);
  await editor.getByLabel('Address line 1', { exact: true }).fill('100 Synthetic Way');
  await editor.getByLabel('City', { exact: true }).fill('Example');
  await editor.getByLabel('Country', { exact: true }).fill('US');
  await editor
    .getByLabel('Evidence reference', { exact: true })
    .fill('Synthetic company directory');
  await editor.getByRole('button', { name: 'Save evidence record', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('Saved for human review');
  const saved = (
    await db.query('select * from public.profile_facts where organization_id=$1 and label=$2', [
      org,
      label,
    ])
  ).rows[0];
  assert(saved);
  assert.equal(saved.structured_kind, 'mailing_address');
  assert.equal(saved.structured_fields.line1, '100 Synthetic Way');
  assert.match(saved.value, /Address line 1: 100 Synthetic Way/);
  await page.reload();
  const fact = page.locator(`#fact-${saved.id}`);
  await expect(fact).toContainText('100 Synthetic Way');
  await fact.getByText('Edit saved evidence', { exact: true }).click();
  await expect(fact.getByLabel('Address line 1', { exact: true })).toHaveValue('100 Synthetic Way');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await db.query(
    "update public.organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",
    [org, user],
  );
  await fact.getByLabel('City', { exact: true }).fill('Not authorized');
  await fact.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(fact.getByRole('status').first()).toContainText('administrator access');
  assert.equal(
    (await db.query('select structured_fields from public.profile_facts where id=$1', [saved.id]))
      .rows[0].structured_fields.city,
    'Example',
  );
  console.log(
    'PASS real staging session: structured save/reload, canonical text, mobile layout and revoked-admin rejection.',
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
  await db.query("update public.organizations set status='suspended' where id=$1", [org]);
  if (user) {
    const removed = await admin.auth.admin.deleteUser(user);
    assert(!removed.error);
  }
  await db.end();
  console.log('Synthetic record/account removed; synthetic workspace suspended again.');
}
