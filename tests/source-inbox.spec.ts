import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
let js = '',
  css = '';
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['tests/fixtures/source-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/source-harness',
    jsx: 'automatic',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'synthetic-actions',
        setup(b) {
          b.onResolve({ filter: /source-actions$/ }, () => ({
            path: path.resolve('tests/fixtures/source-actions.ts'),
          }));
        },
      },
    ],
    alias: {
      'next/link': path.resolve('tests/fixtures/link.tsx'),
      'next/navigation': path.resolve('tests/fixtures/source-navigation.ts'),
    },
  });
  js = bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  css = bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
});
for (const mobile of [false, true])
  test(`source inbox ${mobile ? 'mobile' : 'desktop'} shows provenance and requires review`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/source-harness*', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>',
      }),
    );
    await page.goto('/source-harness');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    await expect(page.getByRole('heading', { name: 'Synthetic energy notice' })).toBeVisible();
    await expect(page.getByText(/Critical source change/)).toBeVisible();
    await expect(page.getByText(/Freshness warning/)).toBeVisible();
    await page.getByText('Source dates, filters and observed history', { exact: true }).click();
    await expect(page.getByText('Published by source: 2026-01-01')).toBeVisible();
    await expect(page.getByText(/First added to BidXchange: 2026-09-18/)).toBeVisible();
    await page.getByText('Review and choose next action', { exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByLabel('Next action').selectOption('converted');
    await page.getByLabel('Review reason').fill('Reviewed source');
    await page.getByRole('button', { name: 'Save review', exact: true }).click();
    await expect(page.getByText('Confirmation required')).toBeVisible();
    await page.getByLabel(/Confirm conversion if selected/).check();
    await page.getByRole('button', { name: 'Save review', exact: true }).click();
    await expect(page.getByText('Synthetic review saved; no pursuit created')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save review', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByLabel('Inbox view').selectOption('dismissed');
    await expect(page.getByRole('heading', { name: 'Synthetic energy notice' })).toHaveCount(0);
  });
test('source route requires authentication', async ({ page }) => {
  await page.goto('/opportunities/sources');
  await expect(page).toHaveURL(/\/login/);
});
