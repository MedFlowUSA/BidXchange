import { test, expect } from '@playwright/test';

test('sample review connects requirements, records, tasks and human draft review without saving', async ({
  page,
}) => {
  const mutations: string[] = [];
  const providerCalls: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url());
    if (/\/api\/|supabase\.co|api\.openai\.com/.test(request.url()))
      providerCalls.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Try a sample bid review', exact: true }).click();
  await expect(page).toHaveURL(/#sample-review$/);
  const preview = page.locator('#sample-review');
  const panel = page.locator('#sample-step');
  await expect(panel).toContainText('confirmation for this bid is missing');
  const license = preview.getByRole('button', { name: 'License requirement', exact: true });
  await license.focus();
  await page.keyboard.press('Enter');
  await expect(license).toHaveAttribute('aria-pressed', 'true');
  await expect(panel).toContainText('Needs human review');
  await expect(panel.locator('dd').first()).toContainText(
    'classification required for the electrical scope',
  );
  await expect(panel).toContainText('Bid lead: compare the classification');
  await preview.getByRole('button', { name: 'Mandatory job walk', exact: true }).click();
  await expect(license).toHaveAttribute('aria-pressed', 'false');
  await expect(panel).toContainText('attendance has not been confirmed');
  await expect(panel).toContainText('Project manager: confirm the date');
  await preview.getByRole('button', { name: 'Company records', exact: true }).click();
  await expect(panel).toContainText('last-checked date');
  await expect(panel.getByRole('link', { name: 'View sample company profile' })).toHaveAttribute(
    'href',
    '/company?workspace=demo',
  );
  await preview.getByRole('button', { name: 'Open work', exact: true }).click();
  await expect(panel).toContainText('Estimator · Request bond confirmation');
  await expect(panel).toContainText('Completing a task does not approve a requirement');
  await preview.getByRole('button', { name: 'Reviewed draft', exact: true }).click();
  await expect(panel).toContainText('Sample draft · not approved');
  await expect(panel).toContainText('[HUMAN INPUT REQUIRED]');
  await expect(panel).toContainText('approves a specific version');
  await expect(preview).toContainText('Fictional demonstration data');
  expect(mutations).toEqual([]);
  expect(providerCalls).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.reload();
  await expect(
    preview.getByRole('button', { name: 'Bid requirements', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('sample changes explain re-review, preserve human authority and reset', async ({ page }) => {
  await page.goto('/');
  const preview = page.locator('#sample-review');
  const summary = preview.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  const status = preview.getByRole('status');
  await preview.getByRole('button', { name: 'Recorded amendment', exact: true }).click();
  await expect(status).toContainText('register sign-off is cleared');
  await expect(status).toContainText('decision is stale');
  await preview.getByRole('button', { name: 'Expired insurance', exact: true }).click();
  await expect(status).toContainText('linked requirement needs review');
  await expect(status).toContainText('Request renewed evidence');
  await expect(preview).toContainText('Previous decisions remain in the history');
  await expect(preview).toContainText('No automatic no-bid decision or approval');
  await preview.getByRole('button', { name: 'Reset example', exact: true }).click();
  await expect(status).toContainText('Choose a change');
  await expect(
    preview.getByRole('button', { name: 'Expired insurance', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
});

test('company profile is directly discoverable and the illustrative answer points to its basis', async ({
  page,
}) => {
  await page.goto('/');
  const answer = page.locator('#ai-assistance');
  await expect(answer).toContainText('SCRIPTED EXAMPLE · FICTIONAL RECORDS');
  await answer
    .getByRole('link', { name: 'See the sample requirements behind this answer' })
    .click();
  await expect(page).toHaveURL(/#sample-review$/);
  await page
    .locator('#company-passport')
    .getByRole('link', { name: 'View sample company profile' })
    .click();
  await expect(page).toHaveURL(/\/company\?workspace=demo$/);
  await expect(page.getByRole('heading', { name: 'Company profile', exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('Apex');
});

test('specific deliverables and manual boundaries are discoverable by keyboard', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'What BidXchange is' })).toContainText(
    'Find the unanswered questions before they become last-minute work.',
  );
  await expect(page.locator('#capabilities')).toContainText('BEFORE COMMITTING ESTIMATING TIME');
  await expect(page.locator('#sample-review')).toContainText(
    'does not determine eligibility or submit bids for you.',
  );
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
  await page.getByText('What can BidBuddy access?', { exact: true }).click();
  await expect(page.locator('#ai-assistance')).toContainText('your role must allow draft creation');
  await expect(page.locator('#ai-assistance')).toContainText('not a live AI response');
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
    'See how to review your first bid in BidXchange.',
  );
  await expect(page.locator('#request-demo')).toContainText('Do not email confidential records.');
  for (const href of ['#sample-review', '#company-passport', '#ai-assistance', '#request-demo']) {
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
    'Before you price the job, review what the bid requires.',
  );
  await expect(
    page.getByRole('link', { name: 'Open the full demo', exact: true }).first(),
  ).toHaveAttribute('href', '/pursuits/DEMO-001?workspace=demo');
  for (const link of await page.getByRole('link', { name: 'Sign In', exact: true }).all())
    await expect(link).toHaveAttribute('href', '/login');
  await expect(page.getByRole('link', { name: 'Open Workspace', exact: true })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Green Energy Solutions');
  await expect(
    page.getByRole('heading', {
      name: 'Find the unanswered questions before they become last-minute work.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'What BidXchange is' })).toBeVisible();
  await expect(page.locator('figure')).toContainText('Fictional demonstration data');
  // White text in the preview must retain its dark panel background.
  await expect(page.locator('figure')).toHaveCSS('background-color', 'rgb(18, 33, 59)');
  await page.getByRole('link', { name: 'Open the full demo', exact: true }).first().click();
  await expect(page).toHaveURL(/\/pursuits\/DEMO-001\?workspace=demo$/);
  await expect(
    page.getByRole('heading', { name: 'Municipal building energy retrofit' }),
  ).toBeVisible();
});

test('request CTAs offer the approved business contact without claiming delivery', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .locator('main')
    .getByRole('link', { name: 'Arrange a walkthrough', exact: true })
    .click();
  await expect(page).toHaveURL(/#request-demo$/);
  const contact = page.getByRole('region', { name: 'Demo contact' });
  await expect(
    contact.getByRole('link', { name: 'Email Manuel for a walkthrough' }),
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
    .getByRole('link', { name: 'How it works', exact: true })
    .click();
  await expect(page).toHaveURL(/#sample-review$/);
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
