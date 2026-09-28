import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import { samDemoReport } from '../apps/web/lib/research/sam-demo';
let js = '',
  css = '';
test.beforeAll(async () => {
  const built = await build({
    entryPoints: ['tests/fixtures/sam-research-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/sam-ui',
    jsx: 'automatic',
    platform: 'browser',
    alias: { 'next/link': path.resolve('tests/fixtures/link.tsx') },
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  js = built.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  css = built.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
});
async function mount(page: Page, options: { available?: boolean; canSave?: boolean } = {}) {
  const requests: Record<string, unknown>[] = [];
  const report = samDemoReport();
  report.canSave = options.canSave ?? true;
  report.results[0].url = 'https://sam.gov/opp/synthetic/view';
  const company = {
    codes: [{ code: '238210', factId: 'synthetic', label: 'Current trade code' }],
    partial: false,
  };
  await page.route('**/sam-test', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }),
  );
  await page.route('**/api/assistant/research/sam**', (r) => {
    if (r.request().method() === 'GET')
      return r.fulfill({ json: { available: options.available ?? true, company } });
    const body = r.request().postDataJSON();
    requests.push(body);
    return r.fulfill({
      json:
        body.action === 'prepare'
          ? {
              available: options.available ?? true,
              company,
              prepared: {
                filters: report.filters,
                warnings: ['Review suggested filters'],
                unsupported: false,
              },
            }
          : { report, company },
    });
  });
  await page.goto('/sam-test');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  await page
    .getByLabel('What bids should BidBuddy look for?')
    .fill('Find electrical notices for my company.');
  await page.getByRole('button', { name: 'Prepare search filters' }).click();
  await expect(page.getByRole('heading', { name: 'Review public search filters' })).toBeVisible();
  return requests;
}
for (const width of [1440, 390])
  test(`reviewed SAM filters, role-controlled save and reset at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests = await mount(page);
    const search = page.getByRole('button', { name: 'Search SAM.gov now' });
    await expect(search).toBeDisabled();
    expect(requests).toHaveLength(1);
    await page.getByRole('button', { name: 'Use company NAICS 238210' }).click();
    await page.getByRole('checkbox').check();
    await search.click();
    await expect(page.getByLabel('SAM.gov research results')).toBeVisible();
    expect(Object.keys(requests[1]).sort()).toEqual([
      'action',
      'consent',
      'filters',
      'organizationId',
      'requestId',
    ]);
    expect(requests[1].consent).toBe(true);
    await expect(page.getByRole('region', { name: 'Review opportunity' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Review before saving opportunity' }).click();
    await expect(page.getByRole('region', { name: 'Review opportunity' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open official SAM.gov/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.tmp/sam-research-${width}.png`, fullPage: true });
    await page.getByLabel('Title keyword or phrase').fill('lighting');
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await expect(search).toBeDisabled();
    await expect(page.getByLabel('SAM.gov research results')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Review opportunity' })).toHaveCount(0);
  });
test('missing SAM key leaves filters reviewable but blocks live search', async ({ page }) => {
  const requests = await mount(page, { available: false });
  await expect(page.getByText(/Live SAM.gov search is not configured/)).toBeVisible();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Search SAM.gov now' })).toBeDisabled();
  expect(requests).toHaveLength(1);
});
test('read-only user cannot open saving; provider failure clears previous results', async ({
  page,
}) => {
  await mount(page, { canSave: false });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Search SAM.gov now' }).click();
  await expect(page.getByLabel('SAM.gov research results')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review before saving opportunity' })).toHaveCount(
    0,
  );
  await page.route('**/api/assistant/research/sam', (r) =>
    r.fulfill({ status: 429, json: { message: 'SAM.gov reached its request limit.' } }),
  );
  await page.getByRole('button', { name: 'Search SAM.gov now' }).click();
  await expect(page.getByRole('status')).toContainText('request limit');
  await expect(page.getByLabel('SAM.gov research results')).toHaveCount(0);
});
