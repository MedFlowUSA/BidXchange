import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
let js = '',
  css = '';
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/fixtures/public-demo-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/public-demo-harness',
    jsx: 'automatic',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  js = result.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  css = result.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
});
for (const width of [1440, 390])
  test(`public demo sends only a prompt and renders live answers at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/public-demo-harness', (r) =>
      r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }),
    );
    await page.route('**/api/demo-assistant', (r) => {
      if (r.request().method() === 'GET') return r.fulfill({ json: { available: true } });
      expect(Object.keys(r.request().postDataJSON()).sort()).toEqual(['prompt', 'requestId']);
      return r.fulfill({
        json: { answer: 'A synthetic model answer.', notice: 'No records accessed.' },
      });
    });
    await page.goto('/public-demo-harness');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    await page.getByLabel('Ask a question').fill('Explain a bid bond.');
    await page.getByRole('button', { name: 'Ask BidBuddy', exact: true }).click();
    await expect(page.getByRole('article', { name: 'AI answer' })).toContainText(
      'A synthetic model answer.',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Clear answer' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('article')).toHaveCount(0);
    await page.route('**/api/demo-assistant', (r) =>
      r.fulfill({
        status: 429,
        json: { message: 'Please wait one minute between demo questions.' },
      }),
    );
    await page.getByLabel('Ask a question').fill('Another question');
    await page.getByRole('button', { name: 'Ask BidBuddy', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Please wait one minute');
  });
