import { test, expect } from '@playwright/test';

test('root is public, accurate and separate from demo and sign-in', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Stop Searching.Start Pursuingthe Right Contracts.',
  );
  await expect(
    page.getByRole('link', { name: 'Explore the Demo', exact: true }).first(),
  ).toHaveAttribute('href', '/dashboard?workspace=demo');
  for (const link of await page.getByRole('link', { name: 'Sign In', exact: true }).all())
    await expect(link).toHaveAttribute('href', '/login');
  await expect(page.getByRole('link', { name: 'Open Workspace', exact: true })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Green Energy Solutions');
  await expect(
    page.getByText('Coming in a later phase — no live AI analysis enabled.'),
  ).toBeVisible();
  for (const name of [
    'Available in the current beta',
    'Foundation implemented',
    'Planned functionality',
  ])
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  await expect(page.locator('figure')).toContainText('Fictional demonstration data');
  await page.getByRole('link', { name: 'Explore the Demo', exact: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard\?workspace=demo$/);
  await expect(
    page.getByRole('heading', { name: 'A clear path to your next pursuit.' }),
  ).toBeVisible();
});

test('request CTAs reach an honestly disabled form that cannot collect data', async ({ page }) => {
  await page.goto('/');
  await page.locator('main').getByRole('link', { name: 'Request a Demo', exact: true }).click();
  await expect(page).toHaveURL(/#request-demo$/);
  await expect(page.getByText('Demo requests are opening soon.', { exact: true })).toBeVisible();
  const form = page.getByRole('form', { name: 'Demo request preview' });
  await expect(form.locator('input,select,textarea,button')).toHaveCount(13);
  for (const control of await form.locator('input,select,textarea,button').all())
    await expect(control).toBeDisabled();
  await expect(form.getByLabel('Full name', { exact: true })).toHaveAttribute('maxlength', '120');
  await expect(form.getByLabel('Work email', { exact: true })).toHaveAttribute('type', 'email');
  await expect(form.getByLabel('Work email', { exact: true })).toHaveAttribute('maxlength', '254');
  await expect(form.getByLabel('Primary service category')).toHaveAttribute('required', '');
  await expect(form.getByRole('button')).toHaveAttribute('type', 'button');
  expect(await form.evaluate((el) => el.tagName)).not.toBe('FORM');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  const requests: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST') requests.push(req.url());
  });
  await form.getByRole('button').dispatchEvent('click');
  expect(requests).toEqual([]);
  await expect(page.getByText('Privacy — pending', { exact: true })).toBeVisible();
  await expect(page.getByText('Terms — pending', { exact: true })).toBeVisible();
});

test('public navigation supports keyboard, mobile escape and section links', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  const toggle = page.getByRole('button', { name: 'Open public navigation', exact: true });
  if (await toggle.isVisible()) {
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Close public navigation' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
  }
  await page
    .getByRole('navigation', { name: 'Public navigation', exact: true })
    .getByRole('link', { name: 'Capabilities', exact: true })
    .click();
  await expect(page).toHaveURL(/#capabilities$/);
  if (await toggle.isVisible()) await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 1024 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('responsive content is contained, rather than hidden by overflow clipping', async ({
  page,
}) => {
  await page.goto('/');
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const locator of [
      page.locator('h1'),
      page.locator('figure'),
      page.getByRole('form', { name: 'Demo request preview' }),
    ]) {
      const bounds = await locator.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    }
  }
});

test('public SEO is canonical and workspace/demo pages remain noindex', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('BidXchange | Find and Qualify Government Contract Opportunities');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://bidxapp.vercel.app/',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /bidxchange-icon/,
  );
  await page.goto('/?workspace=demo');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  for (const route of ['/dashboard?workspace=demo', '/company?workspace=demo', '/login']) {
    await page.goto(route);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  }
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /dashboard');
  const sitemap = await request.get('/sitemap.xml');
  const xml = await sitemap.text();
  expect(xml).toContain('<loc>https://bidxapp.vercel.app/</loc>');
  expect(xml).not.toContain('/dashboard');
});
