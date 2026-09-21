import { test, expect } from '@playwright/test';
import { responseCoverage } from '../apps/web/lib/response-coverage';
import { newResponseDraft } from '../apps/web/lib/response-package';
import { workflowData, pursuit } from './fixtures/workflow-data';
import { build } from 'esbuild';

for (const width of [1440, 390])
  test(`coverage filters and answer editing at ${width}px`, async ({ page }) => {
    const result = await build({
      entryPoints: ['tests/fixtures/coverage-harness.tsx'],
      bundle: true,
      write: false,
      jsx: 'automatic',
      platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' },
    });
    await page.route('**/coverage-harness', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
      }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/coverage-harness');
    await page.addScriptTag({ content: result.outputFiles[0].text });
    await page.getByLabel('Show requirements').selectOption('attention');
    await page.getByText('Provide the required form — Review needed', { exact: true }).click();
    await expect(page.getByText('No answer saved.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit this answer' }).click();
    await expect(page.locator('output')).toHaveText('55555555-5555-4555-8555-555555555555');
    await page.getByLabel('Find a requirement, citation or answer').fill('no match');
    await expect(page.getByText('No requirements match these filters.')).toBeVisible();
    await page.getByLabel('Find a requirement, citation or answer').fill('Training section');
    await expect(page.getByText('Showing 1 of 1 loaded requirements.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

test('coverage scopes answers and flags stale context even when writing is complete', () => {
  const data = workflowData();
  data.decisionContext = 'current';
  const draft = newResponseDraft(data, pursuit);
  draft.answers[0].text = 'Completed narrative.';
  data.requirements![0].owner_user_id = data.userId;
  expect(responseCoverage(data, pursuit, draft).rows[0].needsAttention).toBe(false);
  draft.context = 'old';
  expect(responseCoverage(data, pursuit, draft).rows[0].needsAttention).toBe(true);
  expect(responseCoverage(data, 'another-pursuit', draft).rows).toEqual([]);
});

test('coverage detects missing answers, unfinished text and amended requirements without mutating records', () => {
  const data = workflowData();
  const draft = newResponseDraft(data, pursuit);
  expect(responseCoverage(data, pursuit, draft).rows[0].issues).toContain('Answer missing');
  draft.answers[0].text = '[Confirm delivery plan]';
  data.requirements![0].updated_at = '2026-09-22T00:00:00Z';
  const before = JSON.stringify({ data, draft });
  const row = responseCoverage(data, pursuit, draft).rows[0];
  expect(row.issues).toContain('Unfinished answer placeholders');
  expect(row.issues).toContain('Requirement changed after drafting');
  expect(row.issues).toContain('Review owner missing');
  expect(JSON.stringify({ data, draft })).toBe(before);
});
