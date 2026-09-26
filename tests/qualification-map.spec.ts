import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { qualificationMap } from '../apps/web/lib/qualification-map';
import { passportRecords } from '../apps/web/lib/passport-records';
import { qualificationData } from './fixtures/qualification-data';
import { pursuit } from './fixtures/workflow-data';

test('blockers outrank support; shared evidence and downstream sections stay linked without mutation', () => {
  const data = qualificationData();
  const before = JSON.stringify(data);
  const result = qualificationMap(data, pursuit);
  expect(result.blocked).toBe(1);
  expect(result.rows[0].requirement.requirement).toBe('Insurance coverage');
  expect(result.dependencies[0].requirements).toHaveLength(2);
  expect(result.dependencies[0].responseCount).toBe(1);
  expect(result.rows[1].actions.map((a) => a.kind)).toContain('renewal');
  expect(result.rows[0].answers[0].unfinished).toBe(false);
  expect(JSON.stringify(data)).toBe(before);
});

test('expiration uses deadline timezone and unknown dates never become coverage claims', () => {
  const data = qualificationData();
  data.opportunities[0].official_deadline = '2026-09-22T01:00:00Z';
  data.opportunities[0].deadline_timezone = 'America/Los_Angeles';
  expect(qualificationMap(data, pursuit).deadlineDay).toBe('2026-09-21');
  expect(qualificationMap(data, pursuit).rows[0].evidence[0].needsRenewal).toBe(true);
  data.facts[0].expiration_date = '2026-09-22';
  expect(qualificationMap(data, pursuit).rows[0].evidence[0].needsRenewal).toBe(false);
  data.opportunities[0].deadline_timezone = 'invalid-zone';
  expect(qualificationMap(data, pursuit).deadlineDay).toBeNull();
  data.opportunities[0].official_deadline = null;
  expect(qualificationMap(data, pursuit).deadlinePassed).toBe(false);
});

test('hidden, stale and disabled evidence never becomes current support', () => {
  const data = qualificationData();
  data.evidenceReviews![0].approval_current = null;
  expect(
    qualificationMap(data, pursuit).rows.find((r) => r.requirement.requirement === 'License scope')!
      .evidence[0].current,
  ).toBe(false);
  data.facts = [];
  const result = qualificationMap(data, pursuit);
  expect(result.hiddenEvidence).toBe(true);
  expect(result.dependencies).toEqual([]);
  expect(result.rows.flatMap((r) => r.evidence)).toEqual([]);
  data.evidenceReviewsEnabled = false;
  expect(qualificationMap(data, pursuit).unavailable).toBe(true);
  expect(qualificationMap(data, pursuit).hiddenEvidence).toBe(false);
});

test('amendments propagate to response review; unrelated requirements are excluded', () => {
  const data = qualificationData();
  data.requirements![0].updated_at = '2026-09-21T01:00:00Z';
  data.requirements!.push({
    ...data.requirements![0],
    id: 'foreign',
    pursuit_id: 'another-pursuit',
  });
  data.decisionContext = 'changed';
  const result = qualificationMap(data, pursuit);
  expect(result.rows).toHaveLength(2);
  expect(
    result.rows.find((r) => r.requirement.requirement === 'License scope')!.answers[0]
      .sourceChanged,
  ).toBe(true);
  expect(result.rows.every((r) => r.actions.some((a) => a.kind === 'response'))).toBe(true);
});

test('empty, truncated and unreadable snapshots remain explicit', () => {
  const data = qualificationData();
  data.responsePackages![0].content = 'unreadable';
  expect(qualificationMap(data, pursuit).unreadableDrafts).toBe(true);
  data.facts = Array.from({ length: 500 }, (_, i) => ({ ...data.facts[0], id: String(i) }));
  expect(qualificationMap(data, pursuit).partial).toBe(true);
  data.requirements = [];
  expect(qualificationMap(data, pursuit).rows).toEqual([]);
});

test('Passport recognizes renamed structured records without conflating registrations or bond limits', () => {
  const fact = {
    ...qualificationData().facts[0],
    structured_kind: 'license',
    structured_fields: { number: 'TEST' },
  };
  expect(
    passportRecords([fact], {
      type: 'license',
      label: 'Primary contractor or professional license',
    }),
  ).toHaveLength(1);
  const registration = {
    ...fact,
    fact_type: 'registration',
    structured_kind: 'registration',
    structured_fields: { program: 'Unrelated registry' },
  };
  expect(
    passportRecords([registration], { type: 'registration', label: 'SAM registration' }),
  ).toEqual([]);
  const bond = {
    ...fact,
    fact_type: 'bonding',
    structured_kind: 'bonding',
    structured_fields: { single_limit: '1000' },
  };
  expect(
    passportRecords([bond], { type: 'bonding', label: 'Single-project bonding limit' }),
  ).toHaveLength(1);
  expect(passportRecords([bond], { type: 'bonding', label: 'Aggregate bonding capacity' })).toEqual(
    [],
  );
});

let js: string, css: string;
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['tests/fixtures/qualification-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/qualification-ui',
    jsx: 'automatic',
    platform: 'browser',
    alias: { 'next/link': path.resolve('tests/fixtures/link.tsx') },
    plugins: [
      {
        name: 'mock-actions',
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
  await page.route('**/qualification-test*', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/qualification.css"></head><body><div id="root"></div><script src="/qualification.js"></script></body></html>',
    }),
  );
  await page.route('**/qualification.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: js }),
  );
  await page.route('**/qualification.css', (route) =>
    route.fulfill({ contentType: 'text/css', body: css }),
  );
  await page.goto('/qualification-test' + (viewer ? '?role=viewer' : ''));
}
test('interactive evidence trail, responsive layout and explicit task handoff', async ({
  page,
}) => {
  await mount(page);
  await expect(
    page.getByRole('heading', { name: 'What stands between this opportunity and a reviewed bid?' }),
  ).toBeVisible();
  await expect(page.getByText('Delivery capacity not established', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manage owners and deadlines' })).toHaveAttribute(
    'href',
    /#pursuit-tasks$/,
  );
  await expect(page.getByRole('status')).toContainText('recorded blocker');
  await page
    .getByLabel('Follow an evidence record')
    .selectOption('66666666-6666-4666-8666-666666666666');
  await expect(page.locator('article')).toHaveCount(2);
  await page
    .locator('article')
    .first()
    .getByText('Evidence and response trail (1 records, 1 sections)')
    .click();
  await expect(
    page.locator('article').first().getByText('Synthetic registry', { exact: false }),
  ).toBeVisible();
  await page.locator('article').first().getByText('Assign follow-up work', { exact: true }).click();
  await page
    .locator('article')
    .first()
    .locator('summary')
    .filter({ hasText: /^Add task$/ })
    .click();
  await expect(page.getByRole('textbox', { name: 'Task title', exact: true })).toHaveValue(
    'Review requirement: Insurance coverage',
  );
  await expect(
    page.locator('article').first().getByLabel('Linked requirement', { exact: true }),
  ).toHaveValue(
    qualificationData().requirements!.find((r) => r.requirement === 'Insurance coverage')!.id,
  );
  await expect(
    page.getByRole('heading', { name: 'Bid control: decision, work and dates' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.locator('article').first().getByRole('status')).toContainText(
    'Task saved: Review requirement: Insurance coverage',
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
test('viewers can follow evidence but cannot assign work', async ({ page }) => {
  await mount(page, true);
  await expect(
    page.getByRole('heading', { name: 'Turn review gaps into next actions.' }),
  ).toBeVisible();
  await expect(page.getByText('Assign follow-up work', { exact: true })).toHaveCount(0);
  await expect(
    page
      .locator('#delivery-review')
      .locator('summary')
      .filter({ hasText: /^Add task$/ }),
  ).toHaveCount(0);
});

test('submission stays visible behind a long backlog and date filters reveal hidden work', async ({
  page,
}) => {
  await mount(page);
  await page.goto('/qualification-test?deadlines=1');
  const control = page.getByRole('region', { name: 'Bid control: decision, work and dates' });
  await expect(
    control.getByRole('heading', { name: 'Recorded submission deadline' }),
  ).toBeVisible();
  await expect(control.getByRole('link', { name: 'Confirm job walk date' })).toHaveCount(0);
  await control.getByRole('button', { name: 'Show all 12 matching tasks' }).click();
  await expect(control.getByRole('link', { name: 'Confirm job walk date' })).toBeVisible();
  await control.getByLabel('Focus on work needing attention').selectOption('dates');
  await expect(control.getByRole('link', { name: 'Confirm job walk date' })).toBeVisible();
  await expect(control.getByRole('link', { name: 'Old follow-up 0' })).toHaveCount(0);
  await control.getByLabel('Focus on work needing attention').selectOption('submission');
  await expect(control.getByRole('link', { name: 'Check late bond request' })).toBeVisible();
  await expect(
    control.getByRole('heading', { name: 'Recorded submission deadline' }),
  ).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('delivery checks create explicit owner-assigned follow-up without implying capacity', async ({
  page,
}) => {
  await mount(page);
  const delivery = page.locator('#delivery-review');
  await expect(
    delivery.getByRole('heading', { name: 'Can your team deliver this work?' }),
  ).toBeVisible();
  await delivery
    .locator('summary')
    .filter({ hasText: /^Add task$/ })
    .first()
    .click();
  await expect(delivery.getByRole('textbox', { name: 'Task title', exact: true })).toHaveValue(
    'Delivery review: confirm crew availability and overlapping commitments',
  );
  await delivery.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(delivery.getByRole('status')).toContainText('Task saved: Delivery review:');
  await expect(delivery).toContainText('Task completion is not delivery approval');
});

test('calendar download uses the selected pursuit and selection, with mobile and empty-state support', async ({
  page,
}) => {
  await mount(page, true);
  await page.goto('/qualification-test?role=viewer&deadlines=1');
  const control = page.getByRole('region', { name: 'Bid control: decision, work and dates' });
  await control.getByText('Take these dates to your calendar', { exact: true }).click();
  await expect(control).toContainText('12 dates available · 1 excluded');
  await control.getByLabel('Focus on work needing attention').selectOption('dates');
  // The download is independent of the timeline's display filter.
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const event = page.waitForEvent('download');
    await control.getByRole('button', { name: 'Download calendar (.ics)' }).click();
    const download = await event;
    expect(download.suggestedFilename()).toBe('bidxchange-pursuit-dates.ics');
    const contents = (await readFile((await download.path())!, 'utf8')).replace(/\r\n /g, '');
    expect(contents.match(/BEGIN:VEVENT/g)).toHaveLength(12);
    expect(contents).toContain('Old follow-up 0');
    expect(contents).not.toContain('Confirm job walk date');
    await expect(control).toContainText('No calendar was connected.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await control.screenshot({ path: `.tmp/pursuit-calendar-${width}.png` });
  }
  await control.getByLabel('Include open task deadlines').uncheck();
  await expect(control).toContainText('1 date available · 0 excluded');
  const event = page.waitForEvent('download');
  await control.getByRole('button', { name: 'Download calendar (.ics)' }).click();
  const contents = await readFile((await (await event).path())!, 'utf8');
  expect(contents.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  await page.goto('/qualification-test?calendar-empty=1');
  await control.getByText('Take these dates to your calendar', { exact: true }).click();
  await expect(control.getByRole('button', { name: 'Download calendar (.ics)' })).toBeDisabled();
  await expect(control).toContainText('0 dates available · 1 excluded');
});
