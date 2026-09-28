import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
test.beforeEach(async ({ page }) => {
  const bundle = await build({
    entryPoints: ['tests/fixtures/task-inbox-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/task-inbox-harness',
    jsx: 'automatic',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'link',
        setup(b) {
          b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            resolveDir: process.cwd(),
            contents:
              'import {createElement} from "react"; export default function Link(props){return createElement("a",props);}',
          }));
        },
      },
    ],
  });
  await page.route('**/dashboard?*', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text}</style><div id="root"></div><script>${bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text.replaceAll('</script', '<\\/script')}</script>`,
    }),
  );
});
for (const width of [390, 1440])
  test(`task inbox filters, page links and task handoff at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dashboard?organization=11111111-1111-4111-8111-111111111111');
    await expect(page.getByRole('combobox', { name: 'Task owner', exact: true })).toHaveValue(
      'mine',
    );
    await expect(page.getByText('STALE SAMPLE SHOULD NOT APPEAR')).toHaveCount(0);
    await expect(page.getByRole('listitem').getByText('Overdue', { exact: true })).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Task owner', exact: true })
      .selectOption('unassigned');
    await page.getByRole('combobox', { name: 'Deadline', exact: true }).selectOption('undated');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(
      /organization=11111111-1111-4111-8111-111111111111&task_owner=unassigned&task_timing=undated#today-tasks-heading/,
    );
    await expect(page.getByText(/Unassigned — choose an owner/)).toBeVisible();
    await page.getByRole('link', { name: 'Next tasks' }).click();
    await expect(page).toHaveURL(/task_page=1/);
    await expect(
      page.getByRole('link', { name: 'Confirm certified payroll process', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open task: Confirm certified payroll process' }),
    ).toHaveAttribute('href', /\/pursuits\/22222222.*organization=11111111.*#task-55555555/);
    await page.getByRole('link', { name: 'Previous tasks' }).click();
    await expect(
      page.getByRole('link', {
        name: 'Request bond letter for the municipal lighting retrofit',
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Task owner', exact: true })).toHaveValue(
      'unassigned',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test('query errors and changed-page empty states give honest recovery actions', async ({
  page,
}) => {
  await page.goto('/dashboard?organization=11111111-1111-4111-8111-111111111111&error=true');
  await expect(page.getByRole('alert')).toContainText('Tasks could not be loaded');
  await expect(page.getByText('No open tasks match this view')).toHaveCount(0);
  await page.goto(
    '/dashboard?organization=11111111-1111-4111-8111-111111111111&empty=true&task_page=2',
  );
  await expect(page.getByRole('heading', { name: 'No tasks on this page' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to first page' })).toHaveAttribute(
    'href',
    /task_page=0/,
  );
});

test('server page navigation resets unapplied filter edits to the actual query', async ({
  page,
}) => {
  await page.goto('/dashboard?organization=11111111-1111-4111-8111-111111111111');
  await page.getByRole('combobox', { name: 'Task owner', exact: true }).selectOption('unassigned');
  await page.getByRole('button', { name: 'Simulate server page navigation' }).click();
  await expect(page.getByRole('combobox', { name: 'Task owner', exact: true })).toHaveValue('mine');
  await expect(page.getByRole('navigation', { name: 'Task pages' })).toContainText('Page 2');
});
