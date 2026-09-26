import { test, expect } from '@playwright/test';
test('demo drawer offers general questions without tenant API requests or workspace records', async ({
  page,
}) => {
  let tenantCalls = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/assistant')) tenantCalls++;
  });
  await page.route('**/api/demo-assistant', (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { available: true } });
    expect(Object.keys(r.request().postDataJSON()).sort()).toEqual(['prompt', 'requestId']);
    return r.fulfill({ json: { answer: 'General sample explanation.' } });
  });
  await page.goto('/assistant?workspace=demo');
  const drawer = page.getByRole('dialog', { name: 'BidBuddy', exact: true });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Explain how a bid bond works.', exact: true }).click();
  await drawer.getByRole('button', { name: 'Ask BidBuddy', exact: true }).click();
  await expect(drawer.getByRole('article', { name: 'AI answer' })).toContainText(
    'General sample explanation.',
  );
  await expect(drawer).toContainText('cannot access workspace data or live websites');
  expect(tenantCalls).toBe(0);
  await expect(drawer).not.toContainText('Green Energy Solutions');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await drawer.getByRole('button', { name: 'Clear answer', exact: true }).click();
  await expect(drawer.getByRole('article')).toHaveCount(0);
  await page.reload();
  await expect(drawer.getByRole('article')).toHaveCount(0);
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
