import { test, expect } from '@playwright/test';

for (const [route, title] of [
  ['privacy', 'Privacy Policy'],
  ['terms', 'Terms of Use'],
]) {
  test(`${route} is public, explicitly a draft and readable on mobile and print`, async ({
    page,
  }) => {
    const response = await page.goto(`/${route}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByLabel('Document status')).toContainText('not yet effective');
    await expect(page.locator('main')).toContainText('BidXchange LLC');
    await expect(page.locator('footer')).toContainText('Redlands, California 92373');
    await expect(page.locator('footer a[href="mailto:mrodriguez@oaisinc.com"]')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://bidxapp.vercel.app/${route}`,
    );
    const sectionLink = page
      .getByRole('navigation', { name: 'On this page' })
      .getByRole('link')
      .first();
    await sectionLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/${route}#`));
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByLabel('Document status')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeHidden();
  });
}

test('drafts disclose AI retention and human submission responsibility', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.locator('#ai')).toContainText('not a promise of zero provider retention');
  await expect(page.locator('#retention')).toContainText('not currently enabled');
  await page
    .getByRole('navigation', { name: 'Legal navigation' })
    .getByRole('link', { name: 'Terms of Use' })
    .click();
  await expect(page.locator('#human-review')).toContainText('does not automatically submit bids');
  await expect(page.locator('#agreement')).toContainText('not recorded acceptance');
  await page.goto('/login');
  await page
    .getByRole('navigation', { name: 'Legal documents' })
    .getByRole('link', { name: 'Privacy Policy' })
    .click();
  await expect(page).toHaveURL(/\/privacy$/);
});
