import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import { workspaceGuide, nextActions } from '../apps/web/lib/workspace-guide';
import { releaseActionInput } from '../apps/web/lib/response-release';
import { workflowData, pursuit } from './fixtures/workflow-data';
test('guide uses actual scoped records and role restrictions; next actions prioritize blockers without duplicates', () => {
  const data = workflowData('viewer');
  const before = JSON.stringify(data),
    steps = workspaceGuide(data, pursuit);
  expect(steps).toHaveLength(12);
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
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open getting started' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Workspace guide', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').locator('li')).toHaveCount(12);
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
