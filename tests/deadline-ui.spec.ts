import { expect, test } from '@playwright/test';
import { build } from 'esbuild';

test.beforeEach(async ({ page }) => {
  const bundle = await build({
    entryPoints: ['tests/fixtures/deadline-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/deadline-harness',
    jsx: 'automatic',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'fixtures',
        setup(b) {
          b.onResolve({ filter: /app\/.*actions$/ }, () => ({
            path: 'actions',
            namespace: 'fixture',
          }));
          b.onResolve({ filter: /^next\/(link|navigation)$/ }, (args) => ({
            path: args.path,
            namespace: 'fixture',
          }));
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            resolveDir: process.cwd(),
            contents:
              args.path === 'next/link'
                ? 'import {createElement} from "react"; export default function Link(props){return createElement("a",props);}'
                : args.path === 'next/navigation'
                  ? 'export function useRouter(){return {refresh(){}};}'
                  : [
                      'saveOpportunity',
                      'savePursuitTask',
                      'startPursuit',
                      'saveRequirement',
                      'savePepmaOpportunity',
                      'saveSourceRegistration',
                      'saveNormalizedOpportunity',
                      'saveReleaseAction',
                    ]
                      .map(
                        (name) =>
                          `export async function ${name}(_state,form){window.__saved=Object.fromEntries(form);return {message:'Synthetic saved'};}`,
                      )
                      .join('\n'),
          }));
        },
      },
    ],
  });
  await page.route('**/deadline-harness', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    }),
  );
  await page.goto('/deadline-harness');
  await page.addStyleTag({
    content: bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text,
  });
  await page.addScriptTag({
    content: bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text,
  });
});

for (const width of [390, 1440])
  test(`opportunity and task dates submit explicit instants at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('details[aria-label="Add opportunity"] > summary').click();
    const form = page.getByRole('form', { name: 'Add opportunity', exact: true });
    await form.getByLabel('Opportunity title', { exact: true }).fill('Fictional lighting retrofit');
    await form.getByLabel('Source note', { exact: true }).fill('Fictional notice');
    await form.getByLabel('Official deadline', { exact: true }).fill('2026-10-15T14:00');
    await expect(form.getByText(/Will save:.*2:00:00 PM PDT/)).toBeVisible();
    await form.getByRole('button', { name: 'Add opportunity', exact: true }).click();
    await expect(form.getByRole('status')).toHaveText('Synthetic saved');
    expect(
      await page.evaluate(
        () => (window as unknown as { __saved: Record<string, string> }).__saved.official_deadline,
      ),
    ).toBe('2026-10-15T21:00:00.000Z');
    await page.locator('details[aria-label="Add task"] > summary').click();
    const task = page.getByRole('form', { name: 'Add task', exact: true });
    await task.getByLabel('Task title', { exact: true }).fill('Attend job walk');
    await task.getByLabel('Task deadline', { exact: true }).fill('2026-12-10T09:00');
    await task.getByRole('button', { name: 'Add task', exact: true }).click();
    await expect(task.getByRole('status')).toHaveText('Synthetic saved');
    expect(
      await page.evaluate(
        () => (window as unknown as { __saved: Record<string, string> }).__saved.due_at,
      ),
    ).toBe('2026-12-10T17:00:00.000Z');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

test('DST gaps block saves, repeated times need a choice, and failed saves preserve input', async ({
  page,
}) => {
  await page.locator('details[aria-label="Retry test"] > summary').click();
  const form = page.getByRole('form', { name: 'Retry test', exact: true });
  const date = form.getByLabel('Retry deadline', { exact: true });
  await date.fill('2026-03-08T02:30');
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await form.getByRole('button', { name: 'Retry test', exact: true }).click();
  await expect(form.getByRole('status')).toHaveCount(0);
  await date.fill('2026-11-01T01:30');
  await expect(form.getByText(/This time occurs twice/)).toBeVisible();
  await form
    .getByLabel('Which occurrence of retry deadline?')
    .selectOption('2026-11-01T09:30:00.000Z');
  await form.getByRole('button', { name: 'Retry test', exact: true }).click();
  await expect(form.getByRole('status')).toHaveText(
    'Synthetic save failed: 2026-11-01T09:30:00.000Z',
  );
  await expect(date).toHaveValue('2026-11-01T01:30');
  await form.getByLabel('Retry zone').fill('America/New_York');
  await expect(form.getByLabel('Which occurrence of retry deadline?')).toHaveValue('');
  await form.getByLabel('Retry zone').fill('invalid');
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await form.getByLabel('Retry zone').fill('UTC');
  await expect(date).toHaveAttribute('aria-invalid', 'false');
  await date.fill('');
  await form.getByRole('button', { name: 'Retry test', exact: true }).click();
  await expect(form.getByRole('status')).toHaveText('Synthetic save failed:');
});

test('editing another field retains saved repeated-hour instant and full precision', async ({
  page,
}) => {
  await page.locator('details[aria-label="Edit opportunity"] > summary').click();
  const form = page.getByRole('form', { name: 'Edit opportunity', exact: true });
  await expect(form.getByLabel('Official deadline', { exact: true })).toHaveValue(
    '2026-11-01T01:30:12.123',
  );
  await expect(form.getByLabel('Which occurrence of official deadline?')).toHaveValue(
    '2026-11-01T09:30:12.123Z',
  );
  await form.getByLabel('Buyer', { exact: true }).fill('Corrected fictional buyer');
  await form.getByRole('button', { name: 'Edit opportunity', exact: true }).click();
  await expect(form.getByRole('status')).toHaveText('Synthetic saved');
  expect(
    await page.evaluate(
      () => (window as unknown as { __saved: Record<string, string> }).__saved.official_deadline,
    ),
  ).toBe('2026-11-01T09:30:12.123456+00:00');
});

test('portal intake and human submission forms use zoned controls, not timestamp strings', async ({
  page,
}) => {
  for (const label of ['Record source opportunity', 'Record PEPMA bid']) {
    await page.locator(`details[aria-label="${label}"] > summary`).click();
    const form = page.getByRole('form', { name: label, exact: true });
    for (const input of await form.locator('input[type="datetime-local"]').all())
      await input.fill('2026-10-15T14:00');
    const values = await form
      .locator('input[type="hidden"]')
      .evaluateAll((elements) => elements.map((e) => (e as HTMLInputElement).value));
    expect(values.filter((v) => v === '2026-10-15T21:00:00.000Z').length).toBe(
      label.includes('PEPMA') ? 2 : 5,
    );
  }
  await page.getByText('Prepare a version for human approval', { exact: true }).click();
  await page.getByLabel('Source reviewed at', { exact: true }).fill('2026-09-26T10:30');
  await expect(page.locator('input[name="reviewed_at"]')).toHaveValue('2026-09-26T17:30:00.000Z');
  await page.getByText('Record an actual human submission', { exact: true }).click();
  await page.getByLabel('Actual submission time', { exact: true }).fill('2026-10-15T13:55');
  await expect(page.locator('input[name="submitted_at"]')).toHaveValue('2026-10-15T20:55:00.000Z');
});

test('team members can read saved task instructions and follow only same-pursuit requirements', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const instructions = page.getByRole('region', { name: 'Assigned task instructions' });
  await expect(instructions.getByText('Priority: urgent')).toBeVisible();
  await expect(instructions.getByText(/Request the letter from the surety/)).toContainText(
    '<script>not code</script>',
  );
  await expect(instructions.getByRole('link', { name: 'Provide the required form' })).toHaveCount(
    1,
  );
  await expect(instructions.getByText(/linked requirement is not available/)).toBeVisible();
  await expect(
    instructions.getByText(/bid lead or company administrator can update/),
  ).toBeVisible();
  await expect(instructions.getByRole('button')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
