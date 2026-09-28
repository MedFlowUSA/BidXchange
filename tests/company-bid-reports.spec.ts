import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import { org, pursuit } from './fixtures/workflow-data';
let js = '',
  css = '';
test.beforeAll(async () => {
  const output = await build({
    entryPoints: ['tests/fixtures/company-bid-reports-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/company-reports-harness',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: { 'next/link': path.resolve('tests/fixtures/link.tsx') },
  });
  js = output.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  css = output.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
});
for (const width of [1440, 390])
  test(`company reports generate latest scoped answers and reset bid state at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/company-reports-test*', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
      }),
    );
    const mount = async (query = '') => {
      await page.goto('/company-reports-test' + query);
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: js });
    };
    const queries: URLSearchParams[] = [];
    await page.route('**/api/bid-reports?*', (r) => {
      queries.push(new URL(r.request().url()).searchParams);
      return r.fulfill({ contentType: 'application/pdf', body: '%PDF fixture only' });
    });
    await mount();
    await expect(page.getByRole('button', { name: 'Generate bid report PDF' })).toHaveCount(0);
    await page.getByLabel('Choose a pursuit').selectOption(pursuit);
    await expect(
      page.getByRole('link', { name: 'Review requirements and edit answers' }),
    ).toHaveAttribute('href', `/pursuits/${pursuit}?organization=${org}`);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generate bid report PDF' }).click();
    await download;
    expect(queries[0].get('organization')).toBe(org);
    expect(queries[0].get('pursuit')).toBe(pursuit);
    expect(queries[0].get('answers')).toBe('latest');
    expect(queries[0].has('package')).toBe(false);
    await page.getByLabel(/Include restricted company records/).check();
    await page.getByLabel('Choose a pursuit').selectOption('99999999-9999-4999-8999-999999999999');
    await expect(page.getByLabel(/Include restricted company records/)).not.toBeChecked();
    await expect(page.getByRole('status')).toHaveText('');
    await page.screenshot({ path: `.tmp/company-bid-reports-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByLabel('Find a bid by title, buyer or solicitation').fill('no-such-bid');
    await expect(page.getByText('No bids match this search.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate bid report PDF' })).toHaveCount(0);
    await mount('?viewer');
    await page.getByLabel('Choose a pursuit').selectOption(pursuit);
    await expect(page.getByLabel(/Include restricted company records/)).toHaveCount(0);
    await mount('?empty');
    await expect(
      page.getByRole('link', { name: 'Open opportunities', exact: true }),
    ).toHaveAttribute('href', `/opportunities?organization=${org}`);
    await expect(page.getByText('PDFs prepared outside the app', { exact: false })).toBeVisible();
  });
