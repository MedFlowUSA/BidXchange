// Run with: node --import tsx scripts/test-task-inbox-hosted.mjs
// Staging-only fixtures; user-session reads, no email/provider calls or production writes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { stagingKeys, stagingRef } from './staging/connection.mjs';
import { loadTaskInbox } from '../apps/web/lib/task-inbox-records.ts';
const keys = stagingKeys();
const url = `https://${stagingRef}.supabase.co`;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const operator = createClient(url, keys.service, options);
const organizations = [];
let user;
async function required(promise) {
  const r = await promise;
  if (r.error) throw new Error(r.error.code ?? 'Fixture request failed');
  return r.data;
}
try {
  const email = `task-inbox-${randomUUID()}@example.invalid`;
  user = (await required(operator.auth.admin.createUser({ email, email_confirm: true }))).user.id;
  for (let i = 0; i < 2; i++) {
    const org = randomUUID();
    organizations.push(org);
    await required(
      operator
        .from('organizations')
        .insert({
          id: org,
          legal_name: 'Fictional inbox test',
          operating_name: 'Fictional inbox test',
          slug: `task-inbox-${org}`,
          status: 'active',
        }),
    );
  }
  const [org, foreign] = organizations;
  await required(
    operator
      .from('organization_memberships')
      .insert({ organization_id: org, user_id: user, role: 'estimator', status: 'active' }),
  );
  async function pursuit(organization) {
    const notice = await required(
      operator
        .from('opportunities')
        .insert({ organization_id: organization, title: 'Fictional inbox notice' })
        .select('id')
        .single(),
    );
    return (
      await required(
        operator
          .from('pursuits')
          .insert({
            organization_id: organization,
            opportunity_id: notice.id,
            title: 'Fictional inbox pursuit',
          })
          .select('id')
          .single(),
      )
    ).id;
  }
  const bid = await pursuit(org),
    otherBid = await pursuit(foreign);
  const now = new Date().toISOString();
  const later = new Date(Date.parse(now) + 86400000).toISOString();
  const rows = [
    ...Array.from({ length: 550 }, (_, i) => ({
      organization_id: org,
      pursuit_id: bid,
      title: `Fictional completed ${i}`,
      status: 'complete',
      assigned_user_id: user,
    })),
    ...Array.from({ length: 30 }, (_, i) => ({
      organization_id: org,
      pursuit_id: bid,
      title: `Fictional open ${i}`,
      status: 'todo',
      assigned_user_id: user,
      due_at: later,
      due_timezone: 'America/Los_Angeles',
    })),
    {
      organization_id: org,
      pursuit_id: bid,
      title: 'Fictional unassigned',
      status: 'todo',
      due_at: null,
    },
  ];
  for (let i = 0; i < rows.length; i += 200)
    await required(operator.from('pursuit_tasks').insert(rows.slice(i, i + 200)));
  await required(
    operator
      .from('pursuit_tasks')
      .insert({
        organization_id: foreign,
        pursuit_id: otherBid,
        title: 'Foreign canary',
        status: 'todo',
      }),
  );
  const link = await required(operator.auth.admin.generateLink({ type: 'magiclink', email }));
  const client = createClient(url, keys.anon, options);
  await required(
    client.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token }),
  );
  const first = await loadTaskInbox(
    client,
    org,
    user,
    { owner: 'mine', timing: 'week', page: 0 },
    now,
  );
  assert(!first.error);
  assert.equal(first.rows.length, 25);
  assert(first.hasNext);
  assert(
    first.rows.every(
      (r) => r.pursuitTitle === 'Fictional inbox pursuit' && r.task.status === 'todo',
    ),
  );
  const next = await loadTaskInbox(
    client,
    org,
    user,
    { owner: 'mine', timing: 'week', page: 1 },
    now,
  );
  assert(!next.error);
  assert.equal(next.rows.length, 5);
  assert.equal(next.hasNext, false);
  assert.equal(new Set([...first.rows, ...next.rows].map((r) => r.task.id)).size, 30);
  const unassigned = await loadTaskInbox(
    client,
    org,
    user,
    { owner: 'unassigned', timing: 'undated', page: 0 },
    now,
  );
  assert.equal(unassigned.rows.length, 1);
  assert.equal(unassigned.rows[0].task.title, 'Fictional unassigned');
  const denied = await loadTaskInbox(
    client,
    foreign,
    user,
    { owner: 'all', timing: 'all', page: 0 },
    now,
  );
  assert.equal(denied.rows.length, 0);
  await required(
    operator
      .from('organization_memberships')
      .update({ status: 'suspended' })
      .eq('organization_id', org)
      .eq('user_id', user),
  );
  const revoked = await loadTaskInbox(
    client,
    org,
    user,
    { owner: 'mine', timing: 'all', page: 0 },
    now,
  );
  assert.equal(revoked.rows.length, 0);
  console.log(
    'PASS hosted staging: 581 tasks, filter-before-pagination, tie ordering, scoped title lookup, unassigned/undated filter, foreign organization and revoked membership denied.',
  );
} finally {
  for (const org of organizations)
    await required(operator.from('organizations').update({ status: 'suspended' }).eq('id', org));
  if (user) await required(operator.auth.admin.updateUserById(user, { ban_duration: '876000h' }));
  console.log('Fictional staging organizations suspended and test login banned.');
}
