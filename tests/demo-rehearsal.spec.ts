import { test, expect } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`connected fictional rehearsal preserves history and invalidates approval at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/pursuits/DEMO-001?workspace=demo');
    const exercise = page.getByRole('region', {
      name: 'Bid workspace',
    });
    await expect(exercise).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Record not found', exact: true })).toHaveCount(
      0,
    );
    await expect(
      exercise.getByRole('button', { name: 'Record bid decision', exact: true }),
    ).toBeDisabled();
    await exercise.getByRole('button', { name: 'Simulate insurance renewal' }).click();
    const rows = exercise.locator('details').filter({ has: page.locator('select') });
    for (let i = 0; i < 10; i++) {
      const row = rows.nth(i);
      await row.locator('summary').click();
      await row.locator('select').selectOption('reviewed');
      await row.locator('input').fill('Reviewed fictional source; practice only.');
      await row.locator('summary').click();
    }
    await exercise.getByRole('button', { name: 'Sign off requirements register' }).click();
    await exercise
      .getByLabel('Decision reason', { exact: true })
      .fill('Fictional training decision.');
    await exercise.getByRole('button', { name: 'Record no-bid decision' }).click();
    await expect(exercise.getByRole('button', { name: 'Create response outline' })).toBeDisabled();
    await exercise.getByRole('button', { name: 'Record bid decision', exact: true }).click();
    for (const checkbox of await exercise.getByRole('checkbox').all()) await checkbox.check();
    await exercise.getByRole('button', { name: 'Create response outline' }).click();
    await expect(exercise.getByRole('button', { name: 'Approve this version' })).toBeDisabled();
    const draft = exercise.getByLabel('Response draft', { exact: true });
    await expect(draft).toHaveValue(/\[HUMAN INPUT REQUIRED\]/);
    await draft.fill(
      (await draft.inputValue()).replaceAll('[HUMAN INPUT REQUIRED]', 'Fictional exercise answer'),
    );
    await exercise.getByRole('button', { name: 'Approve this version' }).click();
    await exercise.getByRole('checkbox').first().uncheck();
    await expect(exercise.getByRole('button', { name: 'Record submission' })).toBeDisabled();
    await exercise.getByRole('checkbox').first().check();
    await exercise.getByRole('button', { name: 'Approve this version' }).click();
    await exercise.getByLabel('Named submitter', { exact: true }).fill('Jordan');
    await exercise
      .getByLabel('Portal destination', { exact: true })
      .fill('Sample municipal PlanetBids portal');
    await exercise
      .getByLabel('Actual submitted-at (America/Los_Angeles)', { exact: true })
      .fill('2026-10-08T12:00');
    await exercise
      .getByLabel('Acknowledgment note', { exact: true })
      .fill('Sample confirmation retained.');
    await exercise.getByLabel('Confirmation number').fill('DEMO-RECEIPT');
    await exercise.getByRole('button', { name: 'Record submission' }).click();
    await expect(exercise).toContainText('Historical user-recorded submission:');
    await draft.fill((await draft.inputValue()) + '\nEdited practice text');
    await expect(exercise.getByRole('button', { name: 'Record submission' })).toBeDisabled();
    await exercise.getByRole('button', { name: 'Approve this version' }).click();
    await exercise.getByRole('button', { name: 'Simulate insurance expiration' }).click();
    await expect(exercise).toContainText('Decision: Stale bid');
    await expect(exercise.getByRole('button', { name: 'Record submission' })).toBeDisabled();
    await expect(exercise.locator('.requirement-row').nth(6).locator('summary')).toContainText(
      'Needs review',
    );
    await exercise.locator('#bid-amendments > summary').click();
    await exercise.getByRole('button', { name: 'Simulate an amendment' }).click();
    await expect(
      exercise.getByRole('button', { name: 'Sign off requirements register' }),
    ).toBeDisabled();
    await expect(exercise).toContainText('DEMO-RECEIPT');

    await expect(exercise).toContainText('Alex approved version');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.reload();
    await expect(exercise).toContainText('Decision: Not recorded');
    await expect(exercise).not.toContainText('DEMO-RECEIPT');
  });
}
