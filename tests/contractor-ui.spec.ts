import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
for (const width of [390, 1440])
  test(`contractor forms, stale evidence and final-decision gate at ${width}px`, async ({
    page,
  }) => {
    const bundle = await build({
      entryPoints: ['tests/fixtures/contractor-harness.tsx'],
      bundle: true,
      write: false,
      outdir: '.tmp/contractor-harness',
      jsx: 'automatic',
      platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [
        {
          name: 'actions',
          setup(b) {
            b.onResolve({ filter: /app\/.*actions$/ }, () => ({
              path: 'actions',
              namespace: 'fixture',
            }));
            b.onResolve({ filter: /^next\/navigation$/ }, () => ({
              path: 'navigation',
              namespace: 'fixture',
            }));
            b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
              resolveDir: process.cwd(),
              contents:
                args.path === 'link'
                  ? 'import {createElement} from "react"; export default function Link(props){return createElement("a",props);}'
                  : args.path === 'navigation'
                    ? 'export function useRouter(){return {refresh(){}};}'
                    : [
                        'saveCompanyRecord',
                        'signOffRegister',
                        'recordDecision',
                        'recordAmendment',
                        'reviewAmendment',
                        'saveComparison',
                        'confirmComparison',
                        'saveRequirement',
                        'saveOpportunity',
                        'savePursuit',
                        'startPursuit',
                        'savePursuitTask',
                      ]
                        .map(
                          (name) =>
                            `export async function ${name}(){return {success:true,message:'Synthetic action recorded'};}`,
                        )
                        .join('\n'),
            }));
          },
        },
      ],
    });
    await page.route('**/contractor-harness', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
      }),
    );
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/contractor-harness');
    await page.addStyleTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text,
    });
    await page.addScriptTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text,
    });
    await expect(
      page.getByRole('heading', { name: 'California Contractor Passport' }),
    ).toBeVisible();
    const steps = page
      .getByRole('navigation', { name: 'Company Passport steps' })
      .getByRole('link');
    await expect(steps).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await steps.nth(i).click();
      await expect(steps.nth(i)).toHaveAttribute('aria-current', 'step');
    }
    await expect(
      page.getByRole('heading', { name: 'Which three projects can you describe?' }),
    ).toBeVisible();
    await page.getByLabel('Radar window').selectOption('expired');
    await expect(page.locator('p').filter({ hasText: /^Expired · Last checked:/ })).toBeVisible();
    await page.getByText('Record a decision', { exact: true }).click();
    await expect(page.getByRole('option', { name: 'Pursue bid', exact: true })).toHaveJSProperty(
      'disabled',
      true,
    );
    await expect(page.getByRole('option', { name: 'Do not bid', exact: true })).toHaveJSProperty(
      'disabled',
      true,
    );
    await page.getByLabel('Decision', { exact: true }).selectOption('leaning_bid');
    await page.getByLabel('Estimated pursuit hours').fill('12.5');
    await expect(
      page.getByRole('link', { name: 'Official source · external site' }),
    ).toHaveAttribute('rel', 'noopener noreferrer');
    await page.locator('summary').filter({ hasText: /^Record human amendment review$/ }).click();
    await page.getByLabel('Type reviewed after reading the official change').fill('reviewed');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
