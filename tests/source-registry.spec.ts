import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import { sourceRegistry } from '../apps/web/lib/sources/registry';
import {
  manualAdapter,
  normalizedDetails,
  normalizedInput,
  registrationInput,
  scheduleEligible,
  externalUrl,
} from '../apps/web/lib/sources/normalized';
import { org } from './fixtures/workflow-data';
import { reviewedPortalUrl } from '../apps/web/lib/sources/portal-url';

test('reviewed portal links reject credentials and secret-bearing destinations', () => {
  expect(reviewedPortalUrl('https://agency.gov/vendor')).toBe('https://agency.gov/vendor');
  for (const url of [
    'javascript:alert(1)',
    'https://user:pass@agency.gov',
    'https://agency.gov?api_key=private',
    'https://agency.gov#access_token=private',
    '',
  ])
    expect(reviewedPortalUrl(url)).toBeNull();
});
test('registry distinguishes opportunities, vehicles, research and gated eBuy', () => {
  expect(new Set(sourceRegistry.map((s) => s.id)).size).toBe(sourceRegistry.length);
  for (const id of [
    'cal-eprocure',
    'sb-epro',
    'lausd-ariba',
    'lausd-facilities',
    'sce-ariba',
    'pepma',
    'ladwp',
    'rampla',
    'planetbids',
    'opengov',
    'bonfire',
  ])
    expect(sourceRegistry.find((s) => s.id === id)?.group).toBe('opportunities');
  expect(sourceRegistry.find((s) => s.id === 'cmas')?.group).toBe('vehicles');
  expect(sourceRegistry.find((s) => s.id === 'usaspending')?.group).toBe('research');
  expect(sourceRegistry.find((s) => s.id === 'gsa-ebuy')?.scheduleRequired).toBe(true);
});
test('normalization preserves unknown values and rejects fabricated synchronization', () => {
  const details = manualAdapter('cal-eprocure').normalize({ submissionUrl: '' });
  expect(details.lastSynchronizedAt).toBeNull();
  expect(details.dataConfidence).toBeNull();
  expect(details.questionDeadline).toBe('');
  for (const change of [
    { lastSynchronizedAt: '2026-09-21T12:00:00Z' },
    { dataConfidence: 100 },
    { connectionMode: 'official_api' },
    { sourceId: 'invented' },
    { publishedAt: '2026-09-21T12:00' },
    { unexpected: 'value' },
  ])
    expect(normalizedDetails.safeParse({ ...details, ...change }).success).toBe(false);
  for (const value of [
    'javascript:alert(1)',
    'https://password@agency.gov/',
    'https://127.0.0.1/',
    'http://agency.gov/',
  ])
    expect(externalUrl.safeParse(value).success).toBe(false);
  expect(
    normalizedInput.safeParse({
      organization_id: org,
      record_id: '',
      updated_at: '',
      title: 'Synthetic',
      buyer: 'Agency',
      solicitation_number: 'TEST',
      source_url: 'https://agency.gov/bid',
      source_note: 'Official notice reviewed',
      summary: '',
      official_deadline: '',
      deadline_timezone: 'America/Los_Angeles',
      estimated_value: '',
      details,
      confirmed: 'yes',
    }).success,
  ).toBe(true);
});
test('registration is not authentication and schedule eligibility requires current evidence', () => {
  expect(
    registrationInput.safeParse({
      organization_id: org,
      source_id: 'gsa-ebuy',
      updated_at: '',
      registration_status: 'registered',
      vendor_number: '',
      evidence_reference: '',
      portal_url: '',
      expires_on: '',
      schedule_number: '',
    }).success,
  ).toBe(false);
  const registration = {
    id: 'test',
    source_id: 'gsa-ebuy',
    updated_at: '2026-09-21T00:00:00Z',
    registration_status: 'registered',
    vendor_number: '',
    evidence_reference: 'Synthetic evidence',
    portal_url: '',
    expires_on: '2026-10-01',
    schedule_number: 'Synthetic',
  };
  expect(scheduleEligible(registration, '2026-09-21')).toBe(true);
  expect(scheduleEligible({ ...registration, expires_on: '2026-09-20' }, '2026-09-21')).toBe(false);
  expect(scheduleEligible({ ...registration, schedule_number: '' }, '2026-09-21')).toBe(false);
});
let js = '',
  css = '';
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['tests/fixtures/registry-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/registry-harness',
    jsx: 'automatic',
    platform: 'browser',
    alias: { 'next/link': path.resolve('tests/fixtures/link.tsx') },
    plugins: [
      {
        name: 'actions',
        setup(builder) {
          builder.onResolve({ filter: /registry-actions$/ }, () => ({
            path: path.resolve('tests/fixtures/registry-actions.ts'),
          }));
          builder.onResolve({ filter: /capture-actions$/ }, () => ({
            path: path.resolve('tests/fixtures/pepma-actions.ts'),
          }));
        },
      },
    ],
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  js = bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  css = bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
});
async function mount(page: Page, viewer = false) {
  await page.route('**/registry-test*', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><head><link rel="stylesheet" href="/registry.css"></head><body><div id="root"></div><script src="/registry.js"></script></body></html>',
    }),
  );
  await page.route('**/registry.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: js }),
  );
  await page.route('**/registry.css', (route) =>
    route.fulfill({ contentType: 'text/css', body: css }),
  );
  await page.goto('/registry-test' + (viewer ? '?role=viewer' : ''));
}
test('registry exposes honest status, category separation and eBuy lock on mobile', async ({
  page,
}) => {
  await mount(page);
  await expect(
    page.getByRole('link', { name: 'SAM.gov Federal · External site ↗' }),
  ).toHaveAttribute('href', 'https://sam.gov/opportunities');
  await expect(
    page.getByRole('link', { name: 'SAM.gov Federal · External site ↗' }),
  ).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(
    page.getByText('Manual intake only; automatic connector not connected'),
  ).toBeVisible();
  await page.getByLabel('Source', { exact: true }).selectOption('gsa-ebuy');
  await expect(page.getByRole('status')).toContainText('locked');
  await expect(
    page.locator('summary').filter({ hasText: /^Record source opportunity$/ }),
  ).toHaveCount(0);
  await page.getByLabel('Source category').selectOption('vehicles');
  await expect(page.getByRole('heading', { name: 'CMAS', exact: true })).toBeVisible();
  await expect(
    page.locator('summary').filter({ hasText: /^Record source opportunity$/ }),
  ).toHaveCount(0);
  await page.getByLabel('Source category').selectOption('opportunities');
  await page.getByLabel('Source', { exact: true }).selectOption('cal-eprocure');
  await page
    .locator('summary')
    .filter({ hasText: /^Record source opportunity$/ })
    .click();
  for (const [label, value] of [
    ['Opportunity title', 'Synthetic'],
    ['Buying agency', 'Test agency'],
    ['Solicitation number', 'TEST'],
    ['Source opportunity URL', 'https://agency.gov/bid'],
    ['Source review reference', 'Reviewed notice'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel('Source review', { exact: true }).selectOption('yes');
  await page.getByRole('button', { name: 'Record source opportunity', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    'Saved synthetic normalized source: cal-eprocure',
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
test('read-only member sees no registry or intake mutation controls', async ({ page }) => {
  await mount(page, true);
  await expect(page.getByRole('heading', { name: 'Source registry' })).toBeVisible();
  await expect(page.getByText('Update registration evidence', { exact: true })).toHaveCount(0);
  await expect(
    page.locator('summary').filter({ hasText: /^Record source opportunity$/ }),
  ).toHaveCount(0);
});
