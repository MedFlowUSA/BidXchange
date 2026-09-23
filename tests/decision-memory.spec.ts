import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import {
  memoryReviewSchema,
  reviewStatus,
  requirementFinding,
} from '../apps/web/lib/decision-memory';

test('unreviewed or stale history never implies resolution or qualification', () => {
  expect(reviewStatus(undefined, 'a')).toBe('Needs review');
  expect(
    reviewStatus(
      {
        id: '1',
        decision_id: 'd',
        reason_code: 'bond',
        assessment: 'resolved',
        note: 'Human check',
        source_reference: 'letter',
        reviewed_by: 'user',
        reviewed_at: 'today',
        context_token: 'old',
      },
      'new',
    ),
  ).toBe('Needs review');
  expect(requirementFinding({ id: 'r', text: 'Bond', status: 'needs_review' })).toBe(
    'Support not confirmed in this snapshot',
  );
  expect(memoryReviewSchema.safeParse({}).success).toBe(false);
});
for (const width of [1440, 390])
  test(`Decision Log and human review are usable at ${width}px`, async ({ page }) => {
    const bundle = await build({
      entryPoints: ['tests/fixtures/decision-memory-harness.tsx'],
      bundle: true,
      write: false,
      outdir: '.tmp/memory-harness',
      jsx: 'automatic',
      platform: 'browser',
      alias: { 'next/link': path.resolve('tests/fixtures/link.tsx') },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [
        {
          name: 'actions',
          setup(b) {
            b.onResolve({ filter: /decision-(memory-)?actions$/ }, () => ({
              path: 'actions',
              namespace: 'fixture',
            }));
            b.onResolve({ filter: /^next\/navigation$/ }, () => ({
              path: 'navigation',
              namespace: 'fixture',
            }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
              contents:
                path === 'navigation'
                  ? 'export const useRouter=()=>({refresh(){}});'
                  : `export async function reviewDecisionMemory(s,f){const r=await fetch('/memory-review-test',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});return r.json();} export const recordDecision=reviewDecisionMemory;`,
            }));
          },
        },
      ],
    });
    const js = bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text,
      css = bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
    await page.route('https://fonts.googleapis.com/**', (r) =>
      r.fulfill({ contentType: 'text/css', body: '' }),
    );
    await page.route('**/memory-test*', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/memory.css"><div id="root"></div><script src="/memory.js"></script>',
      }),
    );
    await page.route('**/memory.css', (r) => r.fulfill({ contentType: 'text/css', body: css }));
    await page.route('**/memory.js', (r) =>
      r.fulfill({ contentType: 'text/javascript', body: js }),
    );
    let saved: Record<string, string> | undefined;
    await page.route('**/memory-review-test', (r) => {
      saved = r.request().postDataJSON();
      return r.fulfill({
        json: {
          success: true,
          message: 'Human assessment recorded. No requirement or bid decision was changed.',
        },
      });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/memory-test#company-decisions');
    await expect(
      page.getByRole('heading', { name: 'Company Decision Log', exact: true }),
    ).toBeVisible();
    await page.getByText('Requirements at decision time', { exact: true }).click();
    await expect(page.getByText('Recorded blocker:', { exact: false })).toBeVisible();
    await page.getByText('Record a decision', { exact: true }).click();
    const reasons = page.getByRole('group', {
      name: 'Decision reasons (select all that apply)',
      exact: true,
    });
    await reasons.getByLabel('Bond capacity', { exact: true }).check();
    await reasons.getByLabel('Job walk / pre-bid conflict', { exact: true }).check();
    await expect(reasons.locator('input:checked')).toHaveCount(2);
    await page.goto('/memory-test?match=1');
    await expect(page.getByText('Same agency: example city', { exact: true })).toBeVisible();
    await page.getByText('Bond capacity — Needs review', { exact: true }).click();
    const assessment = page
      .locator('details[open]')
      .filter({ has: page.getByText('Bond capacity — Needs review', { exact: true }) });
    await assessment.getByLabel('Current status', { exact: true }).selectOption('resolved');
    await assessment
      .getByLabel('What did you check?', { exact: true })
      .fill('Reviewed the fictional letter against the new notice.');
    await assessment
      .getByLabel('Supporting record or source reference', { exact: true })
      .fill('Synthetic letter dated today');
    await assessment
      .getByLabel('I reviewed this reason against the new notice.', { exact: false })
      .check();
    await assessment.getByRole('button', { name: 'Record human assessment', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Human assessment recorded' }),
    ).toBeVisible();
    expect(saved?.reason_code).toBe('bond');
    await expect(
      page.getByText('Job walk / pre-bid conflict — Needs review', { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/memory-test?match=1&role=viewer');
    await page.getByText('Bond capacity — Needs review', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Record human assessment' })).toHaveCount(0);
  });
