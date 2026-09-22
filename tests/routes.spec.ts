import { test, expect } from '@playwright/test';
test('direct demo routes survive refresh and browser history', async ({ page }) => {
  await page.goto('/company?workspace=demo');
  await expect(page.getByRole('heading', { name: 'Company', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Company', exact: true })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator('summary')
    .filter({ hasText: /^More$/ })
    .click();
  await page
    .getByRole('navigation', { name: 'More navigation', exact: true })
    .getByRole('link', { name: 'Reports', exact: true })
    .click();
  await expect(page).toHaveURL(/\/reports\?workspace=demo/);
  await page.goBack();
  await expect(page).toHaveURL(/\/company\?workspace=demo/);
  await page.goForward();
  await expect(page).toHaveURL(/\/reports\?workspace=demo/);
  await page.goto('/opportunities/DEMO-001?workspace=demo');
  await expect(
    page.getByRole('heading', { name: 'Municipal building energy retrofit', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Demo workflow stage')).toBeVisible();
  await page.goto('/pursuits/DEMO-002?workspace=demo');
  await expect(
    page.getByRole('heading', {
      name: 'Practice one bid from review to submission record',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /^2\. Requirements Register/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Prepare cost estimate' })).toBeVisible();
});
test('protected routes redirect and unauthorized IDs never switch tenant', async ({ page }) => {
  await page.goto('/operations');
  await expect(page).toHaveURL(/\/login\?next=%2Foperations/);
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('button', { name: 'Email a sign-in link' })).toBeVisible();
  await page.goto('/company?organization=11111111-1111-4111-8111-111111111111');
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/opportunities/DEMO-missing?workspace=demo');
  await expect(page.getByRole('heading', { name: 'Record not found', exact: true })).toBeVisible();
  await page.goto('/company?workspace=demo&organization=11111111-1111-4111-8111-111111111111');
  await expect(
    page.getByRole('heading', { name: 'Record not found or access denied.' }),
  ).toBeVisible();
});
test('workspace picker hides GES from guests and global search is bounded', async ({ page }) => {
  await page.goto('/dashboard?workspace=demo');
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Switch workspace' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Apex Energy Demo');
  await expect(dialog).not.toContainText('Green Energy Solutions');
  await page.keyboard.press('Escape');
  if (await page.getByRole('button', { name: 'Close navigation', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Close navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Global search', exact: true }).click();
  await page.getByRole('textbox', { name: 'Global search query' }).fill('DEMO-001');
  await page
    .getByRole('dialog')
    .getByRole('link', { name: /Municipal building/ })
    .click();
  await expect(page).toHaveURL(/opportunities\/DEMO-001/);
});
test('keyboard dialog focus is confined and export produces nonempty content', async ({ page }) => {
  await page.goto('/dashboard?workspace=demo');
  await page.getByRole('button', { name: 'Add opportunity', exact: true }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => document.querySelector('dialog')?.contains(document.activeElement)),
    ).toBeTruthy();
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.goto('/reports?workspace=demo');
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export brief', exact: true }).click();
  const download = await promise;
  const stream = await download.createReadStream();
  let text = '';
  for await (const chunk of stream!) text += chunk.toString();
  expect(text).toContain('fictional demo brief');
  expect(text).toContain('America/Los_Angeles');
  await expect(page.getByRole('status')).toContainText('exported');
});
