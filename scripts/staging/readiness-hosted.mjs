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
    "select o.id from public.organizations o where o.status='suspended' and o.slug like 'staging-test-%' and not exists(select 1 from public.organization_memberships m join auth.users u on u.id=m.user_id where m.organization_id=o.id and m.status='active' and (u.banned_until is null or u.banned_until<now())) order by o.created_at limit 1",
  )
).rows[0]?.id;
assert(org, 'No quarantined synthetic fixture available');
const facts = [randomUUID(), randomUUID()],
  newProfile = randomUUID();
let user,
  browser,
  profileCreated = false;
try {
  assert.equal(
    (
      await db.query('select count(*)::int n from public.profile_facts where organization_id=$1', [
        org,
      ])
    ).rows[0].n,
    0,
  );
  const email = `readiness-${randomUUID()}@example.invalid`,
    password = randomBytes(24).toString('base64url');
  const made = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert(!made.error);
  user = made.data.user.id;
  await db.query("update public.organizations set status='active' where id=$1", [org]);
  await db.query(
    "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'viewer')",
    [org, user],
  );
  let profile = (
    await db.query('select id from public.company_profiles where organization_id=$1', [org])
  ).rows[0]?.id;
  if (!profile) {
    profile = newProfile;
    await db.query('insert into public.company_profiles(id,organization_id) values($1,$2)', [
      profile,
      org,
    ]);
    profileCreated = true;
  }
  await db.query(
    "insert into public.profile_facts(id,organization_id,company_profile_id,fact_type,label,value,sensitivity,expiration_date) values($1,$3,$4,'license','Synthetic expired license','Synthetic public value','workspace','2020-01-01'),($2,$3,$4,'insurance','PRIVATE SYNTHETIC INSURANCE','PRIVATE SYNTHETIC VALUE','restricted',null)",
    [...facts, org, profile],
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
  await page.goto(`${base}/dashboard?organization=${org}`);
  await expect(
    page.getByRole('heading', { name: 'Review Synthetic expired license', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link'),
  ).toHaveCount(5);
  await page.getByRole('link', { name: 'Open record for review' }).click();
  await expect(page).toHaveURL(new RegExp(`#fact-${facts[0]}$`));
  await expect(page.locator('main')).not.toContainText('PRIVATE SYNTHETIC');
  await expect(page.getByText('Synthetic expired license', { exact: true })).toBeVisible();
  assert.equal(
    (await client.from('profile_facts').select('id').eq('organization_id', org)).data.length,
    1,
  );
  console.log(
    'PASS real viewer sees prioritized expired evidence and five primary routes, without restricted facts',
  );
  await page
    .locator('summary')
    .filter({ hasText: /^More$/ })
    .click();
  await page
    .getByRole('navigation', { name: 'More navigation', exact: true })
    .getByRole('link', { name: 'Reports' })
    .click();
  await expect(page).toHaveURL(/\/reports\?organization=/);
  await page.locator('summary').filter({ hasText: 'Account and organization' }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\?organization=/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log('PASS authenticated secondary reports/settings links and mobile containment');
} finally {
  if (browser) await browser.close();
  await db.query(
    'delete from public.profile_facts where organization_id=$1 and id=any($2::uuid[])',
    [org, facts],
  );
  if (user)
    await db.query(
      'delete from public.organization_memberships where organization_id=$1 and user_id=$2',
      [org, user],
    );
  if (profileCreated)
    await db.query('delete from public.company_profiles where id=$1 and organization_id=$2', [
      newProfile,
      org,
    ]);
  await db.query("update public.organizations set status='suspended' where id=$1", [org]);
  if (user) {
    const removed = await admin.auth.admin.deleteUser(user);
    assert(!removed.error);
  }
  await db.end();
  console.log(
    'Synthetic viewer and facts removed; original synthetic shell returned to suspension.',
  );
}
