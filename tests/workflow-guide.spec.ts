import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import {
  workspaceGuide,
  nextActions,
  hasCurrentRegisterSignoff,
} from '../apps/web/lib/workspace-guide';
import { releaseActionInput } from '../apps/web/lib/response-release';
import { workflowData, pursuit } from './fixtures/workflow-data';
test('guide uses actual scoped records and role restrictions; next actions prioritize blockers without duplicates', () => {
  const data = workflowData('viewer');
  const before = JSON.stringify(data),
    steps = workspaceGuide(data, pursuit);
  expect(steps).toHaveLength(13);
  expect(steps.find((s) => s.id === 'response')?.state).toBe('next');
  expect(steps.find((s) => s.id === 'response')?.locked).toContain('Capture');
  expect(steps.find((s) => s.id === 'evidence')?.state).toBe('next');
  expect(workspaceGuide(data).find((s) => s.id === 'evidence')?.state).toBe('unavailable');
  const next = nextActions(data, 'Pursuits', pursuit);
  expect(next.length).toBeLessThanOrEqual(4);
  expect(next[0].title).toContain('deadline');
  expect(new Set(next.map((a) => a.href)).size).toBe(next.length);
  expect(JSON.stringify(data)).toBe(before);
  data.releaseWorkflow!.enabled = false;
  expect(workspaceGuide(data, pursuit).find((s) => s.id === 'approval')?.state).toBe('unavailable');
  expect(releaseActionInput.safeParse({ action: 'submit', confirmed: false }).success).toBe(false);
});
test('sign-off requires a real record and context; the selected source cannot borrow another opportunity completeness', () => {
  const data = workflowData();
  data.registerSignoffsEnabled = true;
  expect(hasCurrentRegisterSignoff(data)).toBe(false);
  data.decisionContext = 'current';
  expect(workspaceGuide(data, pursuit).find((s) => s.id === 'signoff')?.state).toBe('next');
  data.registerSignoffs = [
    {
      id: 'signoff',
      context_token: 'old',
      note: 'Reviewed',
      signed_off_by: data.userId,
      signed_off_at: data.reviewAsOf,
      requirement_count: 1,
      blocker_count: 0,
      clarification_count: 0,
    },
  ];
  expect(hasCurrentRegisterSignoff(data)).toBe(false);
  data.registerSignoffs[0].context_token = 'current';
  expect(hasCurrentRegisterSignoff(data)).toBe(true);
  data.opportunities.push({ ...data.opportunities[0], id: 'unrelated-complete' });
  data.opportunities[0].source_url = null;
  expect(workspaceGuide(data, pursuit).find((s) => s.id === 'source')?.state).toBe('next');
  expect(workspaceGuide(data, pursuit).find((s) => s.id === 'source')?.href).toContain(
    '/opportunities/opp?',
  );
});

test('current no-bid is a recorded decision and does not recommend response or submission work', () => {
  const data = workflowData();
  data.decisionContext = 'current';
  data.decisions = [
    {
      id: 'decision',
      decision: 'no_bid',
      reason: 'Capacity',
      conditions: '',
      context_token: 'current',
      decided_by: data.userId,
      decided_at: data.reviewAsOf,
    },
  ];
  const steps = workspaceGuide(data, pursuit);
  expect(steps.find((s) => s.id === 'bid')?.state).toBe('recorded');
  for (const id of ['response', 'gaps', 'approval', 'submission'])
    expect(steps.find((s) => s.id === id)?.locked).toContain('no-bid');
  expect(
    nextActions(data, 'Pursuits', pursuit)
      .map((a) => a.href)
      .join(' '),
  ).not.toMatch(/response-packages|response-release/);
  expect(nextActions(data, 'Pursuits', pursuit)[0].title).toBe(
    'Review the recorded no-bid decision',
  );
  data.decisionContext = 'changed';
  expect(workspaceGuide(data, pursuit).find((s) => s.id === 'bid')?.state).toBe('next');
});

let js = '',
  css = '';
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['tests/fixtures/workflow-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/workflow-harness',
    jsx: 'automatic',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'synthetic-actions',
        setup(b) {
          b.onResolve({ filter: /response-release-actions$/ }, () => ({
            path: path.resolve('tests/fixtures/workflow-actions.ts'),
          }));
        },
      },
    ],
    alias: {
      'next/link': path.resolve('tests/fixtures/link.tsx'),
      'next/navigation': path.resolve('tests/fixtures/workflow-navigation.ts'),
    },
  });
  js = bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  css = bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
});
for (const mobile of [false, true])
  test(`workflow guide and explicit submission confirmation ${mobile ? 'mobile' : 'desktop'}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/workflow-harness*', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>',
      }),
    );
    await page.goto('/workflow-harness');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    const brief = page.getByRole('region', { name: 'Suggested next actions' });
    await expect(brief.getByText('Recorded submission deadline', { exact: true })).toBeVisible();
    await expect(brief.getByText('Human-confirmed blockers', { exact: true })).toBeVisible();
    await expect(brief.getByText('No decision recorded', { exact: true })).toBeVisible();
    await expect(brief.getByRole('link', { name: 'Open next action →' })).toHaveAttribute(
      'href',
      /\/opportunities\/opp\?/,
    );
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open getting started' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Workspace guide', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').locator('li')).toHaveCount(13);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByText('Record an actual human submission', { exact: true }).click();
    await page.getByLabel('Actual submission time').fill('2026-09-21T10:00:00Z');
    await page
      .getByLabel('Receipt reference (text only)', { exact: true })
      .fill('Training receipt');
    await page.getByLabel('Submission notes / reason').fill('Synthetic test only.');
    await page.getByRole('button', { name: 'Record human submission', exact: true }).click();
    await expect(page.getByText('Synthetic submission captured; no buyer action.')).toHaveCount(0);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Record human submission', exact: true }).click();
    await expect(page.getByText('Synthetic submission captured; no buyer action.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test('viewer cannot act as approver or submitter', async ({ page }) => {
  await page.route('**/workflow-harness*', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }),
  );
  await page.goto('/workflow-harness?role=viewer');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  await page.getByText('Human approval gates', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record decision' })).toHaveCount(0);
  await page.getByText('Record an actual human submission', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record human submission' })).toHaveCount(0);
});

test('award form preserves official source and defaults to no disclosure permission', async ({
  page,
}) => {
  await page.route('**/workflow-harness*', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }),
  );
  await page.goto('/workflow-harness?submitted=1');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  await page.getByText('Post-submission follow-up', { exact: true }).click();
  await page.getByLabel('Event', { exact: true }).selectOption('award');
  await page
    .getByLabel('What happened / next action', { exact: true })
    .fill('Fictional award only');
  await page.getByLabel('Outcome date', { exact: true }).fill('2026-09-22');
  await page
    .getByLabel('Official outcome source URL or reference', { exact: true })
    .fill('Fictional buyer notice');
  await page.getByLabel('Outcome reason', { exact: true }).fill('Fictional award announcement');
  await expect(page.getByLabel('Permission to disclose', { exact: true })).toHaveValue(
    'not_granted',
  );
  await page.getByRole('button', { name: 'Record follow-up', exact: true }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Official source / reference: Fictional buyer notice' }),
  ).toBeVisible();
  await page.getByLabel('Event', { exact: true }).selectOption('loss');
  await expect(page.getByLabel('Permission to disclose', { exact: true })).toHaveCount(0);
});
