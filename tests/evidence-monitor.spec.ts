import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { monitorHealth, type EvidenceMonitoring } from '../apps/web/lib/evidence-monitor';

test('monitor status distinguishes missing checks, failures, overdue checks and healthy checks', () => {
  const monitor: EvidenceMonitoring = { unavailable: false, status: null, reminders: [] };
  expect(monitorHealth(monitor, '2026-09-22T12:00:00Z')).toContain('pending');
  expect(monitorHealth({ ...monitor, unavailable: true }, '2026-09-22')).toContain(
    'could not be loaded',
  );
  const status = {
    last_attempt_at: '2026-09-22T00:00:00Z',
    last_success_at: '2026-09-22T00:00:00Z',
    failed: false,
  };
  expect(monitorHealth({ ...monitor, status }, '2026-09-22T12:00:00Z')).toContain('running');
  expect(
    monitorHealth({ ...monitor, status: { ...status, failed: true } }, '2026-09-22T12:00:00Z'),
  ).toContain('failed');
  expect(monitorHealth({ ...monitor, status }, '2026-09-24T12:00:00Z')).toContain('overdue');
});
for (const width of [390, 1440])
  test(`evidence reminders offer ownership filter and non-authoritative acknowledgement at ${width}px`, async ({
    page,
  }) => {
    const bundle = await build({
      entryPoints: ['tests/fixtures/reminder-harness.tsx'],
      bundle: true,
      write: false,
      outdir: '.tmp/reminder-harness',
      jsx: 'automatic',
      platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [
        {
          name: 'fixture',
          setup(b) {
            b.onResolve({ filter: /app\/evidence-reminder-actions$/ }, () => ({
              path: 'actions',
              namespace: 'fixture',
            }));
            b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
              resolveDir: process.cwd(),
              contents:
                path === 'link'
                  ? 'import {createElement} from "react";export default function Link(props){return createElement("a",props);}'
                  : 'export async function acknowledgeReminder(){return {success:true,message:"Acknowledged. Evidence and decisions still require human review."};}',
            }));
          },
        },
      ],
    });
    await page.route('**/reminder-harness', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
      }),
    );
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/reminder-harness');
    await page.addStyleTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text,
    });
    await page.addScriptTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text,
    });
    await expect(page.getByRole('heading', { name: 'Evidence reminders' })).toBeVisible();
    await expect(page.getByText('No email or SMS is sent.', { exact: false })).toBeVisible();
    await page.getByLabel('Only reminders assigned to me').check();
    await expect(page.getByRole('link', { name: 'Fictional registration' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Fictional license' })).toHaveAttribute(
      'href',
      /#fact-bbbbbbbb/,
    );
    await page.getByRole('button', { name: 'Acknowledge reminder' }).focus();
    await page.keyboard.press('Enter');
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Evidence and decisions still require human review' }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
