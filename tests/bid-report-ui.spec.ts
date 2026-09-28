import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
let js = '',
  css = '';
test.beforeAll(async () => {
  const out = await build({
    entryPoints: ['tests/fixtures/bid-report-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/bid-report-harness',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
});
for (const width of [1440, 390])
  test(`bid report choices and download recovery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/report-test*', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
      }),
    );
    await page.goto('/report-test');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    let fail = true;
    const queries: URLSearchParams[] = [];
    await page.route('**/api/bid-reports?*', (r) => {
      queries.push(new URL(r.request().url()).searchParams);
      return fail
        ? r.fulfill({
            status: 409,
            json: {
              message: 'Company or bid records changed during export. Reload and try again.',
            },
          })
        : r.fulfill({ contentType: 'application/pdf', body: '%PDF synthetic UI download' });
    });
    await page.getByRole('button', { name: 'Download bid report PDF' }).click();
    await expect(page.getByRole('status')).toContainText('records changed');
    expect(queries[0].get('restricted')).toBe('false');
    expect(queries[0].get('package')).toBe('88888888-8888-4888-8888-888888888888');
    await page.getByLabel(/Include restricted company records/).check();
    await page.getByLabel('Answers to include').selectOption('');
    await page.screenshot({ path: `.tmp/bid-report-card-${width}.png`, fullPage: true });
    fail = false;
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download bid report PDF' }).click();
    expect((await downloaded).suggestedFilename()).toBe('bidxchange-bid-report-22222222.pdf');
    expect(queries[1].get('restricted')).toBe('true');
    expect(queries[1].has('package')).toBe(false);
    await expect(page.getByRole('status')).toContainText('downloaded');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/report-test?viewer');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    await expect(page.getByLabel(/Include restricted/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Download bid report PDF' })).toBeEnabled();
  });
