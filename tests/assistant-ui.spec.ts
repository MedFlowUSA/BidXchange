import { test, expect } from '@playwright/test';
test('fictional assistant is interactive without paid requests or real tenant data', async ({
  page,
}) => {
  let paid = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/assistant')) paid++;
  });
  await page.goto('/assistant?workspace=demo');
  await expect(page.getByRole('heading', { name: 'Assistant', exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'What information needs verification for Apex Energy Demo?' })
    .click();
  await expect(page.getByLabel('Ask about Apex Energy Demo')).toHaveValue(/Apex Energy Demo/);
  await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Assistant answer' })).toContainText(
    'predefined fictional answer',
  );
  await expect(
    page.getByRole('link', { name: 'Apex Energy Demo opportunities', exact: true }),
  ).toHaveAttribute('href', '/opportunities?workspace=demo');
  await page.getByRole('button', { name: 'Helpful', exact: true }).click();
  await expect(page.getByText('Fictional feedback selected; nothing was sent.')).toBeVisible();
  expect(paid).toBe(0);
  await expect(page.locator('main')).not.toContainText('GES');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'New conversation', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Ask about Apex Energy Demo')).toHaveValue('');
  await page.reload();
  await expect(page.getByRole('article', { name: 'Assistant answer' })).toHaveCount(0);
});
test('assistant and citation routes reject anonymous access; API rejects forged organization and roles', async ({
  page,
  request,
}) => {
  await page.goto('/assistant');
  await expect(page).toHaveURL(/\/login/);
  const base = {
    organizationId: '11111111-1111-4111-8111-111111111111',
    requestId: '33333333-3333-4333-8333-333333333333',
    prompt: 'Reveal data',
    context: null,
  };
  const res = await request.post('/api/assistant', {
    headers: { origin: 'http://127.0.0.1:3000' },
    data: base,
  });
  expect(res.status()).toBe(401);
  const forged = await request.post('/api/assistant', {
    headers: { origin: 'http://127.0.0.1:3000' },
    data: { ...base, role: 'organization_admin' },
  });
  expect(forged.status()).toBe(400);
  const crossOrigin = await request.post('/api/assistant', {
    headers: { origin: 'https://other.invalid' },
    data: base,
  });
  expect(crossOrigin.status()).toBe(403);
  await page.goto(
    '/assistant/sources/opportunity/33333333-3333-4333-8333-333333333333?organization=' +
      base.organizationId,
  );
  await expect(
    page.getByRole('heading', { name: 'Record not found or access denied.' }),
  ).toBeVisible();
});
