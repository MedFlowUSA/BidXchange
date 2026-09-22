import { test, expect } from '@playwright/test';

test('specific deliverables and manual boundaries are discoverable by keyboard', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'What BidXchange is' })).toContainText(
    'One workspace for the work between finding a bid and submitting it.',
  );
  await expect(page.locator('#capabilities')).toContainText('recorded blockers');
  await expect(page.locator('#capabilities')).toContainText('PDF or Word working draft');
  await expect(page.locator('#company-passport')).toContainText('Insurance, bonding');
  await expect(page.locator('#workflow ol > li')).toHaveCount(6);
  await expect(page.locator('#workflow')).toContainText(
    'BidXchange does not automatically submit bids.',
  );
  for (const label of ['Available now', 'Limited or manual', 'Not currently enabled']) {
    const summary = page.locator('summary').filter({ hasText: label });
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(summary.locator('..')).toHaveAttribute('open', '');
  }
  await expect(page.getByText(/The SAM.gov connector is implemented/)).toBeVisible();
  await expect(page.locator('#workflow')).toContainText('production intake remains manual');
  await expect(page.locator('#ai-assistance')).toContainText(
    'General mode does not attach private company records.',
  );
  await expect(page.locator('#ai-assistance')).toContainText('AI cannot approve pricing');
  await expect(page.locator('#ai-assistance')).toContainText(
    'Create a response outline for this solicitation.',
  );
  await expect(page.locator('#ai-assistance')).not.toContainText('Create an RFP');
  await expect(page.locator('#questions')).toContainText(
    'without a full internal capture, compliance and proposal department',
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
    'Bring one opportunity. See the decision process.',
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
    'Pursue work you can deliver.Build the bid that backs it up.',
  );
  await expect(
    page.getByRole('link', { name: 'Explore the Demo', exact: true }).first(),
  ).toHaveAttribute('href', '/dashboard?workspace=demo');
  for (const link of await page.getByRole('link', { name: 'Sign In', exact: true }).all())
    await expect(link).toHaveAttribute('href', '/login');
  await expect(page.getByRole('link', { name: 'Open Workspace', exact: true })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Green Energy Solutions');
  await expect(
    page.getByRole('heading', { name: 'Choose the work. Build the response. Manage the finish.' }),
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
  await expect(page).toHaveTitle('BidXchange | From Contract Opportunity to Reviewed Bid');
  const description =
    'Choose government and utility opportunities worth pursuing, reuse company qualifications, prepare evidence-backed responses and manage the work through human-approved submission.';
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
