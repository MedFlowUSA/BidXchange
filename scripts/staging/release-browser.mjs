import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { chromium, expect } from '@playwright/test';
import pg from 'pg';
import { stagingDatabase, stagingKeys, stagingRef } from './connection.mjs';
pg.types.setTypeParser(1184, (v) => v);
const base = process.argv[2];
assert.equal(
  base,
  'http://127.0.0.1:3102',
  'Only isolated local app with staging configuration is allowed',
);
assert.equal(process.env.BIDXCHANGE_STAGING_LOCAL, '1');
const db = await stagingDatabase(),
  keys = stagingKeys(),
  url = `https://${stagingRef}.supabase.co`;
const service = createClient(url, keys.service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const users = [];
let org, browser;
try {
  const email = `release-${randomUUID()}@example.invalid`,
    password = randomBytes(24).toString('base64url');
  for (const address of [email, `reviewer-${randomUUID()}@example.invalid`]) {
    const made = await service.auth.admin.createUser({
      email: address,
      password,
      email_confirm: true,
    });
    assert(!made.error);
    users.push(made.data.user.id);
  }
  org = (
    await db.query(
      "insert into public.organizations(legal_name,operating_name,slug,status) values('Synthetic Release Validation','Synthetic Release Validation',$1,'active') returning id",
      [`staging-release-${randomUUID()}`],
    )
  ).rows[0].id;
  await db.query(
    "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin'),($1,$3,'executive_approver')",
    [org, ...users],
  );
  const opp = (
    await db.query(
      "insert into public.opportunities(organization_id,title,solicitation_number,source_url,official_deadline,deadline_timezone) values($1,'Synthetic release notice','TRAINING-001','https://example.com/training',now()+interval '10 days','UTC') returning id",
      [org],
    )
  ).rows[0].id;
  const pursuit = (
    await db.query(
      "insert into public.pursuits(organization_id,opportunity_id,title) values($1,$2,'Synthetic release validation') returning id",
      [org, opp],
    )
  ).rows[0].id;
  const req = (
    await db.query(
      "insert into public.pursuit_requirements(organization_id,pursuit_id,requirement,citation,owner_user_id) values($1,$2,'Training optional form','Training brief section 1',$3) returning id,updated_at",
      [org, pursuit, users[0]],
    )
  ).rows[0];
  async function as(user, sql, args) {
    await db.query('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    try {
      return await db.query(sql, args);
    } finally {
      await db.query('set role postgres');
    }
  }
  await as(
    users[1],
    "select public.resolve_pursuit_requirement($1,$2,$3,null,'waived','Synthetic training waiver',null,'Synthetic officer','Training amendment 1')",
    [org, req.id, req.updated_at],
  );
  const token = (
    await as(users[0], 'select public.pursuit_decision_context($1,$2) token', [org, pursuit])
  ).rows[0].token;
  const pversion = (await db.query('select updated_at from public.pursuits where id=$1', [pursuit]))
    .rows[0].updated_at;
  await as(
    users[0],
    "select public.record_pursuit_decision($1,$2,$3,$4,'bid','Synthetic human training decision','')",
    [org, pursuit, pversion, token],
  );
  await db.query(
    "insert into public.proposal_sections(organization_id,pursuit_id,title,content,status) values($1,$2,'BID response: Synthetic release',$3,'draft')",
    [
      org,
      pursuit,
      JSON.stringify({
        schema: 1,
        kind: 'BID',
        context: token,
        summary: 'Complete synthetic response for validation only.',
        answers: [
          {
            requirementId: req.id,
            requirementVersion: req.updated_at.replace(' ', 'T').replace(/\+00$/, '+00:00'),
            text: 'Training form waived by the documented synthetic amendment.',
          },
        ],
      }),
    ],
  );
  const cookies = new Map(),
    client = createServerClient(url, keys.anon, {
      cookies: {
        getAll: () => [...cookies.values()],
        setAll: (values) => values.forEach((c) => cookies.set(c.name, c)),
      },
    });
  assert(!(await client.auth.signInWithPassword({ email, password })).error);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  context.setDefaultTimeout(30000);
  await context.addCookies(
    [...cookies.values()].map((c) => ({
      name: c.name,
      value: c.value,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    })),
  );
  const page = await context.newPage();
  await page.goto(`${base}/pursuits/${pursuit}?organization=${org}`);
  console.log('Authenticated staging pursuit loaded.');
  await expect(
    page.getByRole('heading', { name: 'Readiness, approvals and submission' }),
  ).toBeVisible();
  await page.getByText('Prepare a version for human approval', { exact: true }).click();
  await page
    .getByLabel('Official source / amendment version reviewed', { exact: true })
    .fill('Training amendment 1');
  await page
    .getByLabel('Source reviewed at (ISO timestamp', { exact: false })
    .fill(new Date(Date.now() - 1000).toISOString());
  await page
    .getByLabel('Required submission method', { exact: true })
    .fill('Synthetic training portal');
  await page
    .getByLabel('Buyer portal URL or submission destination (no credentials)', { exact: true })
    .fill('https://example.com/training');
  await page.getByLabel('Named submitter', { exact: true }).selectOption(users[0]);
  const labels = [
    'Official submission instructions',
    'Required attachments',
    'Required forms',
    'Required signatures',
    'Required certifications',
    'Amendment acknowledgments',
    'Pricing document',
    'File naming',
    'File formats',
    'Size and page limits',
    'Complete source and amendment review',
  ];
  for (const label of labels) {
    await page.getByLabel(label, { exact: true }).selectOption('confirmed');
    await page
      .getByLabel(`${label}: confirmation reference or reason`, { exact: true })
      .fill('Training brief section 1 reviewed');
  }
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic-final.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Synthetic final response. No actual procurement submission.'),
  });
  await page
    .getByLabel('synthetic-final.txt — storage reference', { exact: false })
    .fill('Synthetic training vault / final');
  await page.getByRole('button', { name: 'Freeze response version', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Synthetic release · version/ })).toBeVisible({
    timeout: 45000,
  });
  console.log('Frozen version recorded through server action.');
  await page.getByText('Human approval gates', { exact: true }).click();
  for (const label of [
    'Pricing approved',
    'Compliance review completed',
    'Final response approved',
    'Submission authorized',
  ]) {
    const gate = page
      .locator('section.release-check')
      .filter({ has: page.getByRole('heading', { name: new RegExp('^' + label + ':') }) });
    await gate.getByLabel('Decision', { exact: true }).selectOption('approved');
    await gate
      .getByLabel('Rationale', { exact: true })
      .fill('Synthetic human review completed; training only.');
    await gate.getByRole('button', { name: 'Record decision', exact: true }).click();
    await expect(gate.getByRole('heading')).toContainText(': Current', { timeout: 45000 });
  }
  const link = page.getByRole('link', { name: 'Download internal handoff packet (JSON)' });
  const packetResponse = await context.request.get(
    new URL(await link.getAttribute('href'), base).href,
  );
  assert.equal(packetResponse.status(), 200);
  const packet = await packetResponse.json();
  assert.equal(packet.readiness.state, 'Authorized for submission');
  assert.equal(packet.approvals.length, 4);
  assert.equal(packet.release.snapshot.checklist.files.length, 1);
  await page.getByText('Record an actual human submission', { exact: true }).click();
  await page
    .getByLabel('Actual submission time (ISO timestamp with timezone)', { exact: true })
    .fill(new Date().toISOString());
  await page
    .getByLabel('Receipt reference (text only)', { exact: true })
    .fill('Synthetic validation receipt. No actual buyer delivery.');
  await page
    .getByLabel('Submission notes / reason for correction or resubmission', { exact: true })
    .fill('Synthetic test event only.');
  await page.getByRole('checkbox', { name: /I am the named submitter/ }).check();
  await page.getByRole('button', { name: 'Record human submission', exact: true }).click();
  await expect(page.getByText('Submitted', { exact: true })).toBeVisible({ timeout: 45000 });
  await page.getByText('Post-submission follow-up', { exact: true }).click();
  await page.getByLabel('Event', { exact: true }).selectOption('lessons_learned');
  await page
    .getByLabel('What happened / next action', { exact: true })
    .fill('Synthetic workflow validation complete.');
  await page.getByRole('button', { name: 'Record follow-up', exact: true }).click();
  await expect(page.getByText(/Synthetic workflow validation complete/)).toBeVisible();
  await page.getByRole('button', { name: 'Workspace guide', exact: true }).click();
  await expect(page.getByRole('dialog').locator('li')).toHaveCount(12);
  await page.keyboard.press('Escape');
  console.log(
    'PASS: authenticated staging browser → local hashes → freeze → four approvals → private handoff → confirmed submission → follow-up → guide. No buyer contacted.',
  );
} finally {
  await browser?.close();
  if (org) await db.query("update public.organizations set status='suspended' where id=$1", [org]);
  for (const id of users) {
    const result = await service.auth.admin.updateUserById(id, { ban_duration: '876000h' });
    assert(!result.error, 'Synthetic account quarantine failed');
  }
  await db.end();
  console.log(
    'Synthetic staging organization suspended; test accounts banned. Immutable test history retained.',
  );
}
