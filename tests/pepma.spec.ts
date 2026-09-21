import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import { isPepmaUrl, pepmaInput, pepmaOpportunity, pepmaHome } from '../apps/web/lib/pepma';
import { org } from './fixtures/workflow-data';
const input = {
  organization_id: org,
  title: 'Synthetic utility bid',
  solicitation_number: 'TEST-1',
  source_url: pepmaHome,
  buyer: 'SCE',
  bid_category: 'Third-party program',
  service_area: 'Synthetic territory',
  bid_manager: '',
  question_deadline: '',
  official_deadline: '2026-10-15T14:00:00-07:00',
  summary: 'Synthetic scope',
  source_note: 'Invitation TEST-1, reviewed by capture team',
  latest_update: 'Q&A 1',
  confirmed: 'yes',
};
test('PEPMA intake preserves bid fields, unknown dates and manual provenance', () => {
  const parsed = pepmaInput.parse(input);
  const result = pepmaOpportunity(parsed, new Date('2026-09-21T12:00:00Z'));
  expect(result.buyer).toBe('SCE');
  expect(result.official_deadline).toBe(input.official_deadline);
  expect(result.deadline_timezone).toBe('America/Los_Angeles');
  expect(result.source_note).toContain('Questions due (recorded offset): Not recorded');
  expect(result.source_note).toContain('Latest addendum / Q&A reference: Q&A 1');
  expect(result.source_note).toContain('not a portal sync timestamp');
  expect(result.record_id).toBe('');
  for (const change of [
    { confirmed: '' },
    { buyer: 'Invented' },
    { official_deadline: '2026-10-15T14:00' },
    { source_note: '' },
    { organization_id: 'demo' },
  ])
    expect(pepmaInput.safeParse({ ...input, ...change }).success).toBe(false);
  expect(
    pepmaOpportunity(
      pepmaInput.parse({
        ...input,
        service_area: 'x'.repeat(200),
        bid_manager: 'x'.repeat(200),
        source_note: 'x'.repeat(700),
        latest_update: 'x'.repeat(200),
      }),
    ).source_note.length,
  ).toBeLessThanOrEqual(2000);
});
test('PEPMA identification rejects spoofed hosts, credentials and unsafe protocols', () => {
  expect(isPepmaUrl(pepmaHome)).toBe(true);
  for (const url of [
    'https://pepma-ca.com.evil.invalid/',
    'https://evil.invalid/pepma-ca.com',
    'https://user:password@www.pepma-ca.com/',
    'javascript:alert(1)',
    'http://www.pepma-ca.com/',
    'https://www.pepma-ca.com:444/',
  ]) {
    expect(isPepmaUrl(url)).toBe(false);
    expect(pepmaInput.safeParse({ ...input, source_url: url }).success).toBe(false);
  }
});
let js = '',
  css = '';
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['tests/fixtures/pepma-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/pepma-harness',
    jsx: 'automatic',
    platform: 'browser',
    alias: { 'next/link': path.resolve('tests/fixtures/link.tsx') },
    plugins: [
      {
        name: 'capture-transport',
        setup(builder) {
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
  await page.route('**/pepma-test*', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><head><link rel="stylesheet" href="/pepma.css"></head><body><div id="root"></div><script src="/pepma.js"></script></body></html>',
    }),
  );
  await page.route('**/pepma.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: js }),
  );
  await page.route('**/pepma.css', (route) =>
    route.fulfill({ contentType: 'text/css', body: css }),
  );
  await page.goto('/pepma-test' + (viewer ? '?role=viewer' : ''));
}
test('intake saves through capture and follow-ups remain editable review tasks', async ({
  page,
}) => {
  await mount(page);
  await page.getByText('Record PEPMA bid', { exact: true }).click();
  for (const [label, value] of [
    ['PEPMA bid name', input.title],
    ['PEPMA bid number', input.solicitation_number],
    ['IOU service area', input.service_area],
    ['Invitation / source reference', input.source_note],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel('Sponsoring utility').selectOption('SCE');
  await page.getByLabel('PEPMA bid category').selectOption('Third-party program');
  await page.getByLabel('Source and sharing review').selectOption('yes');
  await page.getByRole('button', { name: 'Record PEPMA bid', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('no account synchronization');
  await page
    .getByRole('button', { name: 'Plan follow-up: Questions and addenda', exact: true })
    .click();
  await page.getByText('Add task', { exact: true }).click();
  await expect(page.getByLabel('Task title', { exact: true })).toHaveValue(
    'PEPMA: Questions and addenda',
  );
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByText('Task saved: PEPMA: Questions and addenda')).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
test('viewer can read the PEPMA checklist without mutation controls', async ({ page }) => {
  await mount(page, true);
  await expect(page.getByRole('heading', { name: 'PEPMA bid desk' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Plan follow-up/ })).toHaveCount(0);
  await expect(page.getByLabel('PEPMA bid intake')).toHaveCount(0);
});
