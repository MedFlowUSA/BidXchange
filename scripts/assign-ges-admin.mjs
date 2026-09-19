import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { connectDatabase } from './db.mjs';
const userId = process.env.GES_ADMIN_USER_ID;
const email = process.env.GES_ADMIN_EMAIL?.trim().toLowerCase();
if (!userId && !email) throw new Error('Set GES_ADMIN_USER_ID or GES_ADMIN_EMAIL explicitly.');
if (userId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId))
  throw new Error('Invalid administrator UUID.');
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error('Invalid administrator email.');
const project = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const keys = JSON.parse(
  execFileSync('supabase', ['projects', 'api-keys', '--project-ref', project, '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
const key = keys.find((k) => k.name === 'service_role')?.api_key;
if (!key) throw new Error('Authenticated setup credentials unavailable.');
const auth = createClient(`https://${project}.supabase.co`, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let user;
if (userId) {
  const result = await auth.auth.admin.getUserById(userId);
  if (result.error) throw new Error('Administrator account not found.');
  user = result.data.user;
} else {
  for (let page = 1; page <= 100 && !user; page++) {
    const result = await auth.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw new Error('Could not list application users.');
    user = result.data.users.find((u) => u.email?.toLowerCase() === email);
    if (result.data.users.length < 100) break;
  }
  if (!user && process.argv.includes('--create-account')) {
    const result = await auth.auth.admin.createUser({ email, email_confirm: false });
    if (result.error)
      throw new Error('Could not provision the explicitly requested email account.');
    user = result.data.user;
  }
}
if (!user)
  throw new Error(
    'No matching account. Sign in first, or explicitly add --create-account to provision the supplied email without a password.',
  );
if (email && user.email?.toLowerCase() !== email)
  throw new Error('User ID and email do not match.');
const db = await connectDatabase();
try {
  await db.query('begin');
  const org = (
    await db.query(
      "select id from public.organizations where slug='green-energy-solutions' for update",
    )
  ).rows[0];
  if (!org) throw new Error('Run the GES onboarding migration first.');
  const owners = (
    await db.query(
      "select user_id from public.organization_memberships where organization_id=$1 and role='organization_admin' and status='active'",
      [org.id],
    )
  ).rows;
  if (owners.some((o) => o.user_id !== user.id))
    throw new Error(
      'GES already has another administrator. Use its existing administrator workflow.',
    );
  await db.query(
    "insert into public.organization_memberships(organization_id,user_id,role,status) values($1,$2,'organization_admin','active') on conflict(organization_id,user_id) do update set role='organization_admin',status='active',updated_at=now()",
    [org.id, user.id],
  );
  await db.query('commit');
  console.log(
    JSON.stringify({
      organizationId: org.id,
      administratorUserId: user.id,
      role: 'organization_admin',
      emailVerified: !!user.email_confirmed_at,
      note: 'Passwordless email verification is required to sign in. No password stored. No email sent by this setup command.',
    }),
  );
} catch (error) {
  await db.query('rollback');
  throw error;
} finally {
  await db.end();
}
