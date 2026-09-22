import { test, expect } from '@playwright/test';

test('specific deliverables and manual boundaries are discoverable by keyboard', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'What BidXchange is' })).toContainText(
    'Bid review for contractors who do the work',
  );
  await expect(page.locator('#capabilities')).toContainText('before committing estimating time');
  await expect(page.locator('#workflow')).toContainText('BidXchange does not submit bids for you.');
  const scope = page.locator('#current-scope summary');
  await scope.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#current-scope')).toHaveAttribute('open', '');
  await expect(page.locator('#current-scope')).toContainText('Production intake remains manual');
  await expect(page.locator('#ai-assistance')).toContainText(
    'General mode does not access private company records',
  );
  await expect(page.locator('#ai-assistance')).toContainText(
    'approve pricing, verify legal qualifications',
  );
  await expect(page.locator('#ai-assistance')).toContainText(
    'Create a response outline for this solicitation.',
  );
  await expect(page.locator('#ai-assistance')).not.toContainText('Create an RFP');
  await expect(page.locator('#questions')).toContainText(
    'contractor owners, estimators, bid coordinators and project managers',
  );
  for (const summary of await page.locator('#questions summary').all()) {
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(summary.locator('..')).toHaveAttribute('open', '');
  }
  await expect(page.locator('#security')).toContainText(
    'organization membership and role-based access',
  );
  await expect(page.locator('#questions')).toContainText('does not guarantee eligibility');
  await expect(page.locator('#request-demo')).toContainText(
    'Bring one real notice. We will walk the review with you.',
  );
  await expect(page.locator('#request-demo')).toContainText('Do not email confidential records.');
  for (const href of ['#capabilities', '#workflow', '#questions', '#request-demo']) {
    await expect(page.locator(href)).toHaveCount(1);
    await expect(page.locator(`a[href="${href}"]`).first()).toHaveAttribute('href', href);
  }
  await expect(page.locator('main')).not.toContainText('A decision you can defend.');
  await expect(page.locator('main')).not.toContainText('Less chasing.');
});

test('root is public, accurate and separate from demo and sign-in', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'See the notice beside the company — then decide if the bid is worth the week.',
  );
  await expect(
    page.getByRole('link', { name: 'Explore the Demo', exact: true }).first(),
  ).toHaveAttribute('href', '/dashboard?workspace=demo');
  for (const link of await page.getByRole('link', { name: 'Sign In', exact: true }).all())
    await expect(link).toHaveAttribute('href', '/login');
  await expect(page.getByRole('link', { name: 'Open Workspace', exact: true })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Green Energy Solutions');
  await expect(
    page.getByRole('heading', { name: 'Put your bid effort where it counts.' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'What BidXchange is' })).toBeVisible();
  await expect(page.locator('figure')).toContainText('Fictional demonstration data');
  await page.getByRole('link', { name: 'Explore the Demo', exact: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard\?workspace=demo$/);
  await expect(
    page.getByRole('heading', { name: 'A clear path to your next pursuit.' }),
  ).toBeVisible();
});

test('request CTAs offer the approved business contact without claiming delivery', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .locator('main')
    .getByRole('link', { name: 'Request a Bid Review', exact: true })
    .click();
  await expect(page).toHaveURL(/#request-demo$/);
  const contact = page.getByRole('region', { name: 'Demo contact' });
  await expect(
    contact.getByRole('link', { name: 'Email Manuel for a Bid Review' }),
  ).toHaveAttribute(
    'href',
    'mailto:mrodriguez@oaisinc.com?subject=BidXchange%20bid%20review%20request',
  );
  await expect(contact).toContainText('send the message there to request a walkthrough');
  await expect(page.getByRole('form', { name: 'Request a bid review' })).toHaveCount(0);
  await expect(page.getByText('Demo requests are opening soon.')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await expect(page.getByRole('link', { name: 'Privacy Policy', exact: true })).toHaveAttribute(
    'href',
    '/privacy',
  );
  await expect(page.getByRole('link', { name: 'Terms of Use', exact: true })).toHaveAttribute(
    'href',
    '/terms',
  );
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
  const pricing = page.locator('#pricing summary');
  await pricing.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#pricing')).toHaveAttribute('open', '');
  await expect(page.locator('#pricing p')).toBeVisible();
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
      page.getByRole('region', { name: 'Demo contact' }),
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
  await expect(page).toHaveTitle('BidXchange | California Contractor Bid Control');
  const description =
    'Bid review for California field contractors. Keep licenses, DIR registration, insurance, bid requirements and deadlines together so your team can decide whether to bid and prepare its response.';
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    description,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    await page.title(),
  );
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
