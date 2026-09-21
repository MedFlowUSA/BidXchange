import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
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
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, keys.service, options),
  anon = createClient(url, keys.anon, options);
const run = randomUUID(),
  email = `intake-${run}@example.invalid`,
  password = randomBytes(24).toString('base64url');
const users = [];
let browser;
let lead;
try {
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
  assert(bypass, 'Protection cookie unavailable');
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
  ]);
  const page = await context.newPage();
  await page.goto(base);
  const form = page.getByRole('form', { name: 'Request a bid review' });
  await expect(form).toBeVisible();
  await form.getByLabel('Full name', { exact: true }).fill('Synthetic Intake Test');
  await form.getByLabel('Work email', { exact: true }).fill(email);
  await form.getByLabel('Company name', { exact: true }).fill(`Synthetic ${run}`);
  await form
    .getByLabel('Trade, geographic market, agencies or opportunity link', { exact: false })
    .fill('Synthetic staging request. No email should be sent.');
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Request a bid review' }).click();
  await expect(form.getByRole('status')).toContainText('Your request was saved', {
    timeout: 20000,
  });
  lead = (await db.query('select id,version from public.demo_requests where email=$1', [email]))
    .rows[0];
  assert(lead);
  console.log('PASS real browser form saves to staging and reports no email delivery');
  const direct = await anon.rpc('submit_demo_request', {
    p_name: 'Synthetic',
    p_email: email,
    p_company: 'Synthetic',
    p_message: '',
    p_ip_hash: 'a'.repeat(64),
    p_email_hash: 'b'.repeat(64),
  });
  assert(direct.error);
  console.log('PASS anonymous direct intake RPC denied');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert(!created.error);
  users.push(created.data.user.id);
  const cookies = new Map();
  const client = createServerClient(url, keys.anon, {
    cookieOptions: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => [...cookies.values()],
      setAll: (values) => values.forEach((c) => cookies.set(c.name, c)),
    },
  });
  assert(!(await client.auth.signInWithPassword({ email, password })).error);
  assert.equal((await client.from('demo_requests').select('id')).data.length, 0);
  assert.equal(
    (
      await client.rpc('review_demo_request', {
        p_id: lead.id,
        p_version: 1,
        p_status: 'contacted',
      })
    ).data,
    false,
  );
  console.log('PASS real unassigned JWT cannot read or mutate intake');
  await db.query('insert into private.demo_operators(user_id) values($1)', [users[0]]);
  await context.addCookies(
    [...cookies.values()].map((c) => ({
      name: c.name,
      value: c.value,
      url: base,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    })),
  );
  await page.goto(base + '/operations');
  await expect(page.getByRole('heading', { name: `Synthetic ${run}`, exact: true })).toBeVisible();
  const card = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: `Synthetic ${run}`, exact: true }) });
  await card.getByRole('combobox').selectOption('contacted');
  await card.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Synthetic ${run}`, exact: true })).toHaveCount(0);
  assert.equal(
    (await db.query('select status from public.demo_requests where id=$1', [lead.id])).rows[0]
      .status,
    'contacted',
  );
  assert.equal(
    (await client.rpc('review_demo_request', { p_id: lead.id, p_version: 1, p_status: 'closed' }))
      .data,
    false,
  );
  console.log('PASS authorized browser operator review persists and stale writes fail');
  await db.query('delete from private.demo_operators where user_id=$1', [users[0]]);
  assert.equal((await client.from('demo_requests').select('id')).data.length, 0);
  const revoked = await page.goto(base + '/operations');
  assert.equal(revoked.status(), 404);
  console.log('PASS operator revocation immediately blocks existing JWT and browser session');
  console.log('Hosted intake validation passed. No provider requests or outbound emails.');
} catch (error) {
  console.error(
    'Hosted intake validation failed:',
    error.name,
    String(error.message).slice(0, 250),
  );
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await db.query('delete from private.demo_operators where user_id=any($1::uuid[])', [users]);
  const rows = await db.query('delete from public.demo_requests where email=$1 returning id', [
    email,
  ]);
  for (const row of rows.rows)
    await db.query('delete from private.demo_request_events where request_id=$1', [row.id]);
  for (const id of users) {
    const result = await admin.auth.admin.deleteUser(id);
    assert(!result.error, 'Synthetic cleanup failed');
  }
  await db.end();
  console.log('Synthetic lead, events and account removed; rate counters retained.');
}
