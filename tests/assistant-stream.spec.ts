import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
let js = '',
  css = '';
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['tests/fixtures/assistant-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/assistant-harness',
    jsx: 'automatic',
    alias: { 'next/link': path.resolve('tests/fixtures/link.tsx') },
    define: { 'process.env.NODE_ENV': '"production"' },
    platform: 'browser',
  });
  js = bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  css = bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
});
async function mount(page: Page, available = true) {
  await page.route('**/assistant-test', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<html><head><link rel="stylesheet" href="/assistant-harness.css"></head><body><div id="root"></div><script src="/assistant-harness.js"></script></body></html>',
    }),
  );
  await page.route('**/assistant-harness.js', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: js }),
  );
  await page.route('**/assistant-harness.css', (r) =>
    r.fulfill({ contentType: 'text/css', body: css }),
  );
  await page.route('**/api/assistant/status?*', (r) =>
    r.fulfill({ json: { available, access: 'synthetic-user:viewer' } }),
  );
  await page.goto('/assistant-test');
  await expect(page.getByLabel('Ask about Synthetic Test Company')).toBeVisible();
}
test('verified streamed event renders citations and copy/feedback controls', async ({ page }) => {
  await page.route('**/api/assistant', (r) =>
    r.fulfill({
      contentType: 'application/x-ndjson',
      body:
        JSON.stringify({ type: 'status', text: 'Retrieving scoped records…' }) +
        '\n' +
        JSON.stringify({
          type: 'answer',
          answer: {
            answer: [{ text: 'Synthetic opportunity — unverified', sources: ['opportunity:test'] }],
            evidence: [],
            risks: ['Unverified'],
            nextAction: 'Human review required.',
            notice: 'No live feeds.',
            citations: [
              {
                key: 'opportunity:test',
                type: 'opportunity',
                title: 'Synthetic opportunity',
                id: 'test',
                status: 'unverified',
                updatedAt: null,
                href: '/opportunities/test?organization=11111111-1111-4111-8111-111111111111',
              },
            ],
          },
        }) +
        '\n',
    }),
  );
  await mount(page);
  await page.getByLabel('Ask about Synthetic Test Company').fill('Review opportunities');
  await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
  await expect(page.getByRole('article')).toContainText('Synthetic opportunity — unverified');
  await expect(
    page.getByRole('link', { name: 'Synthetic opportunity', exact: true }),
  ).toHaveAttribute('href', /organization=11111111/);
  await expect(page.getByRole('button', { name: 'Copy answer' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
test('cancel aborts generation and exposes retry without saving partial output', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/assistant', async (r) => {
    await gate;
    await r.fulfill({ contentType: 'application/x-ndjson', body: '' }).catch(() => {});
  });
  await mount(page);
  await page.getByLabel('Ask about Synthetic Test Company').fill('Review');
  await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel generation' }).click();
  release();
  await expect(page.getByRole('alert')).toContainText('Generation cancelled.');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
});
for (const [label, status, body] of [
  ['rate limit', 429, JSON.stringify({ message: 'The assistant usage limit has been reached.' })],
  ['timeout', 200, JSON.stringify({ type: 'error', message: 'The assistant timed out.' }) + '\n'],
  ['disconnect', 200, ''],
  ['outage', 503, JSON.stringify({ message: 'The model service is unavailable.' })],
] as const) {
  test(`accessible ${label} state`, async ({ page }) => {
    await page.route('**/api/assistant', (r) =>
      r.fulfill({
        status,
        contentType: status === 200 ? 'application/x-ndjson' : 'application/json',
        body,
      }),
    );
    await mount(page);
    await page.getByLabel('Ask about Synthetic Test Company').fill('Review');
    await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
  });
}
test('unconfigured assistant remains safely unavailable', async ({ page }) => {
  await mount(page, false);
  await expect(page.getByText(/AI is unavailable for this workspace/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask BidXchange', exact: true })).toBeDisabled();
});

for (const change of ['revoked', 'role', 'pagehide'] as const) {
  test(`private conversation clears on ${change}`, async ({ page }) => {
    await page.route('**/api/assistant', (route) =>
      route.fulfill({
        contentType: 'application/x-ndjson',
        body:
          JSON.stringify({
            type: 'answer',
            answer: {
              answer: [{ text: 'SYNTHETIC PRIVATE ANSWER', sources: ['synthetic'] }],
              evidence: [],
              citations: [],
              risks: [],
              nextAction: 'Review.',
              notice: 'No live feeds.',
            },
          }) + '\n',
      }),
    );
    await mount(page);
    await page.getByLabel('Ask about Synthetic Test Company').fill('Synthetic private question');
    await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
    await expect(page.getByRole('article')).toContainText('SYNTHETIC PRIVATE ANSWER');
    if (change === 'pagehide') {
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    } else {
      await page.route('**/api/assistant/status?*', (route) =>
        route.fulfill({
          json: {
            available: change === 'role',
            access: change === 'role' ? 'synthetic-user:contributor' : null,
          },
        }),
      );
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    }
    await expect(page.getByRole('article')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /1\. Synthetic private question/ })).toHaveCount(
      0,
    );
    await expect(page.getByLabel('Ask about Synthetic Test Company')).toHaveValue('');
    if (change === 'revoked')
      await expect(
        page.getByRole('button', { name: 'Ask BidXchange', exact: true }),
      ).toBeDisabled();
    expect(
      await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
    ).toEqual({ local: 0, session: 0 });
  });
}
