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
      plugins: [
        {
          name: 'stub-request-form-only',
          setup(build) {
            build.onResolve({ filter: /^\.\/information-requests$/ }, () => ({
              path: 'request-form',
              namespace: 'stub',
            }));
            build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
              contents: 'export const ProfileInformationRequest = () => null;',
              loader: 'js',
            }));
          },
        },
      ],
    });
    await page.route('**/company-layout-test*', (r) =>
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
    await expect(page.getByRole('heading', { name: 'Your company details' })).toBeVisible();
    await expect(page.getByText('Evidence: needs review', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review company evidence' })).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.tmp/company-overview-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: /Records to review/ }).click();
    await expect(nav.getByRole('link', { name: 'Review queue', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('heading', { name: 'Review company evidence' })).toBeVisible();
    await page.screenshot({ path: `.tmp/company-review-${width}.png`, fullPage: true });
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
    await expect(page.getByRole('heading', { name: 'Review company evidence' })).toBeVisible();
    await nav.getByRole('link', { name: 'Overview', exact: true }).click();
    await page.getByRole('link', { name: 'Website service claim', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Saved evidence example' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your company details' })).not.toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Your company details' })).toBeVisible();
    await nav.getByRole('link', { name: 'Edit profile', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Company draft')).toHaveValue('Unsaved contractor details');
    await nav.getByRole('link', { name: 'Requests', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Requested information' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/company-layout-test?viewer&empty#company-overview');
    await page.addStyleTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text,
    });
    await page.addScriptTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text,
    });
    const snapshot = page.getByRole('region', { name: 'Your company details' });
    await expect(snapshot.getByRole('link', { name: 'View profile', exact: true })).toBeVisible();
    await expect(snapshot.getByRole('link', { name: 'Open profile section' })).toHaveCount(3);
    await expect(snapshot.getByRole('link', { name: 'Website service claim' })).toHaveCount(0);
    await expect(
      page.getByText('Your view may exclude restricted records.', { exact: false }),
    ).toBeVisible();
    await snapshot.getByRole('link', { name: 'Open profile section' }).first().click();
    await expect(page.getByLabel('Company draft')).toBeVisible();
  });
