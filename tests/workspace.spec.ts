import { test, expect, type Page } from '@playwright/test';
async function navigate(page: Page, name: string) {
  await expect(page.locator('main h1')).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation').getByRole('link', { name, exact: false }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
test('dashboard, navigation, search and empty results', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A clear path to your next pursuit.' }),
  ).toBeVisible();
  await navigate(page, 'Opportunities');
  await page.getByRole('textbox', { name: 'Search opportunities' }).fill('weatherization');
  await expect(
    page.getByRole('heading', { name: 'School district weatherization program', exact: true }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Search opportunities' }).fill('unmatched search');
  await expect(page.getByRole('heading', { name: 'No opportunities found' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  for (const name of ['Pursuits', 'Company', 'Documents', 'Reports']) {
    await navigate(page, name);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
});
test('manual intake persists and unverified eligibility blocks pursuit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add opportunity', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Opportunity title').fill('Fictional retrofit test');
  await dialog.getByLabel('Buyer / issuing office').fill('Sample buyer');
  await dialog.getByLabel('Deadline (your device timezone)').fill('2026-12-01T14:00');
  await dialog.getByRole('button', { name: 'Add opportunity', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Fictional retrofit test', exact: true }),
  ).toBeVisible();
  await page.reload();
  await navigate(page, 'Opportunities');
  await page.getByRole('heading', { name: 'Fictional retrofit test', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Pursuing', exact: true })).toHaveAttribute(
    'disabled',
    '',
  );
  await page.getByLabel('Demo workflow stage').selectOption('In review');
  await page.getByRole('link', { name: /Back to (opportunities|pursuits)/ }).click();
  await expect(page.locator('main h1')).toHaveText(/^(Opportunities|Pursuits)$/);
  await navigate(page, 'Pursuits');
  await expect(
    page.getByRole('heading', { name: 'Fictional retrofit test', exact: true }),
  ).toBeVisible();
});
test('eligible pursuit supports tasks and exports a labeled brief', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('heading', { name: 'Municipal building energy retrofit', exact: true })
    .click();
  const dialog = page.getByRole('region', { name: 'Opportunity details' });
  await dialog.getByLabel('Demo workflow stage').selectOption('Pursuing');
  await dialog.getByRole('checkbox', { name: 'Confirm estimating capacity' }).check();
  await page.getByRole('link', { name: /Back to (opportunities|pursuits)/ }).click();
  await expect(page.locator('main h1')).toHaveText(/^(Opportunities|Pursuits)$/);
  await navigate(page, 'Pursuits');
  await page
    .getByRole('heading', { name: 'Municipal building energy retrofit', exact: true })
    .click();
  await expect(dialog.getByRole('checkbox', { name: 'Confirm estimating capacity' })).toBeChecked();
  await page.getByRole('link', { name: /Back to (opportunities|pursuits)/ }).click();
  await expect(page.locator('main h1')).toHaveText(/^(Opportunities|Pursuits)$/);
  await navigate(page, 'Reports');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export brief', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('bidxchange-demo-brief.txt');
});
test('failed licensing blocks a pursuit and documents open accessibly', async ({ page }) => {
  await page.goto('/');
  await navigate(page, 'Opportunities');
  await page
    .getByRole('heading', { name: 'Fleet depot EV charging installation', exact: true })
    .click();
  await expect(page.getByRole('option', { name: 'Pursuing', exact: true })).toHaveAttribute(
    'disabled',
    '',
  );
  await page.keyboard.press('Escape');
  await navigate(page, 'Documents');
  await page.getByRole('button', { name: /Bid readiness checklist/ }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Final submission remains with the authorized contractor.',
  );
});
