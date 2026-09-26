import { test, expect } from '@playwright/test';
import { handoffGaps, safePortalUrl, portalPlaybook } from '../apps/web/lib/submission-handoff';

test('handoff fails closed for each missing human gate and never provides a submit API', () => {
  const ready = {
    signed: true,
    evidenceCurrent: true,
    addendaAcknowledged: true,
    bidCurrent: true,
    submitter: 'Jordan',
    destination: 'Buyer portal',
    humanComplete: true,
  };
  expect(handoffGaps(ready)).toEqual([]);
  for (const field of [
    'signed',
    'evidenceCurrent',
    'addendaAcknowledged',
    'bidCurrent',
    'humanComplete',
  ] as const)
    expect(handoffGaps({ ...ready, [field]: false })).toHaveLength(1);
  for (const field of ['submitter', 'destination'] as const)
    expect(handoffGaps({ ...ready, [field]: '  ' })).toHaveLength(1);
  expect(safePortalUrl('javascript:alert(1)')).toBeNull();
  expect(safePortalUrl('https://user:password@example.com')).toBeNull();
  expect(safePortalUrl('https://example.com/?token=private')).toBeNull();
  expect(safePortalUrl('https://sam.gov/opportunities')).toBe('https://sam.gov/opportunities');
  expect(portalPlaybook('PlanetBids').steps.join(' ')).toContain('resubmit');
});

for (const width of [390, 1440])
  test(`demo entry, drawer, Passport and bid navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let aiRequests = 0;
    await page.route('**/api/demo-assistant', (route) => {
      aiRequests++;
      if (route.request().method() === 'GET') return route.fulfill({ json: { available: true } });
      expect(Object.keys(route.request().postDataJSON()).sort()).toEqual(['prompt', 'requestId']);
      return route.fulfill({ json: { answer: 'A bid bond is a form of bid security.' } });
    });
    const externalWrites: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        !new URL(request.url()).hostname.match(/localhost|127\.0\.0\.1/)
      )
        externalWrites.push(request.url());
    });
    await page.goto('/dashboard?workspace=demo');
    await expect(page).toHaveURL(/pursuits\/DEMO-001\?workspace=demo/);
    await expect(page.locator('main h1')).toHaveText('Municipal building energy retrofit');
    const next = page.getByRole('region', { name: 'Next step', exact: true });
    await expect(next).toBeInViewport();
    await expect(next.getByRole('link')).toHaveText('Update general liability insurance');
    await page.screenshot({ path: `.tmp/bid-control-${width}.png` });
    await expect(page.getByRole('region', { name: 'Live demo AI' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add opportunity', exact: true })).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(
      /eligibility check|readiness score|training register|practice one bid|No mandatory event/i,
    );
    expect(aiRequests).toBe(0);
    await page
      .getByRole('button', { name: width === 390 ? 'Open BidBuddy' : 'BidBuddy', exact: true })
      .click();
    const drawer = page.getByRole('dialog', { name: 'BidBuddy', exact: true });
    await expect(drawer).toBeVisible();
    await drawer.getByLabel('Ask a question').fill('Explain a bid bond');
    await drawer.getByRole('button', { name: 'Ask BidBuddy', exact: true }).click();
    await expect(drawer.getByRole('article')).toContainText('bid security');
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    const navigation = page.getByRole('navigation', {
      name: width === 390 ? 'Mobile navigation' : 'Main navigation',
      exact: true,
    });
    await navigation.getByRole('link', { name: /Passport/ }).click();
    await expect(page.getByRole('heading', { name: 'Keep the evidence current' })).toBeVisible();
    await page.getByRole('button', { name: 'Simulate insurance renewal', exact: true }).click();
    await page.getByRole('link', { name: 'Open municipal retrofit', exact: true }).click();
    await expect(next.getByRole('link')).toHaveText('Review remaining requirements (10 left)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(externalWrites).toEqual([]);
  });

test('documented blockers allow no-bid only after all dispositions; amendments clear handoff', async ({
  page,
}) => {
  await page.goto('/pursuits/DEMO-001?workspace=demo');
  await expect(
    page.getByRole('button', { name: 'Sign off requirements register', exact: true }),
  ).toBeDisabled();
  const rows = page.locator('.requirement-row');
  for (let i = 0; i < 10; i++) {
    await rows.nth(i).locator('summary').click();
    await rows.nth(i).locator('select').selectOption('not_applicable');
    if (i !== 9) await rows.nth(i).locator('input').fill('Human review: documented exclusion.');
    await rows.nth(i).locator('summary').click();
  }
  await expect(
    page.getByRole('button', { name: 'Sign off requirements register', exact: true }),
  ).toBeDisabled();
  await rows.nth(9).locator('summary').click();
  await rows.nth(9).locator('input').fill('Reviewed original source.');
  await rows.nth(2).locator('summary').click();
  await rows.nth(2).locator('select').selectOption('blocker');
  await page.getByLabel('Decision reason', { exact: true }).fill('Bond capacity unresolved.');
  await expect(
    page.getByRole('button', { name: 'Record no-bid decision', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Sign off requirements register', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Record bid decision', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Record no-bid decision', exact: true }).click();
  await expect(page.locator('#bid-decision')).toContainText('Current no-bid');
  await expect(page.locator('#bid-handoff')).toContainText('Not ready for handoff');
  await page.locator('#bid-amendments > summary').click();
  await page.getByRole('button', { name: 'Simulate an amendment', exact: true }).click();
  await expect(page.locator('#bid-decision')).toContainText('Stale no-bid');
  await expect(page.locator('#bid-handoff')).toContainText('Acknowledge every addendum.');
});
