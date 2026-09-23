import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
for (const width of [1440, 390])
  test(`Company sections preserve drafts, direct links and history at ${width}px`, async ({
    page,
  }) => {
    page.on('pageerror', (error) => {
      throw error;
    });
    const bundle = await build({
      entryPoints: ['tests/fixtures/company-portal-harness.tsx'],
      bundle: true,
      write: false,
      outdir: '.tmp/portal-test',
      format: 'iife',
      jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"production"' },
      alias: { 'next/link': path.resolve('tests/fixtures/link.tsx') },
    });
    await page.route('**/company-layout-test', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
      }),
    );
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/company-layout-test#passport-identity');
    await page.addStyleTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text,
    });
    await page.addScriptTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text,
    });
    const nav = page.getByRole('navigation', { name: 'Company sections' });
    await expect(nav.getByRole('link', { name: 'Edit profile', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.getByLabel('Company draft').fill('Unsaved contractor details');
    await nav.getByRole('link', { name: 'Overview', exact: true }).click();
    await expect(page.getByLabel('Company draft')).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Turn company details into usable bid evidence' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ask about company records' })).toHaveAttribute(
      'href',
      /\/assistant\?organization=/,
    );
    await expect(page.getByRole('link', { name: 'Add a PEPMA notice' })).toHaveAttribute(
      'href',
      /#pepma-intake$/,
    );
    await page.getByRole('link', { name: 'Website service claim', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Saved evidence example' })).toBeVisible();
    await page.goBack();
    await page.getByRole('link', { name: 'Review a saved record', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Saved evidence example' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profile overview' })).not.toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Profile overview' })).toBeVisible();
    await nav.getByRole('link', { name: 'Edit profile', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Company draft')).toHaveValue('Unsaved contractor details');
    await nav.getByRole('link', { name: 'Requests', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Requested information' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
