import { test, expect } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`connected fictional rehearsal preserves history and invalidates approval at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/pursuits/DEMO-001?workspace=demo');
    const exercise = page.getByRole('region', {
      name: 'Practice one bid from review to submission record',
    });
    await expect(exercise).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Record not found', exact: true })).toHaveCount(
      0,
    );
    await expect(
      exercise.getByRole('button', { name: 'Record training bid', exact: true }),
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
    await exercise.getByRole('button', { name: 'Sign off training register' }).click();
    await exercise
      .getByLabel('Decision reason', { exact: true })
      .fill('Fictional training decision.');
    await exercise.getByRole('button', { name: 'Record training no-bid' }).click();
    await expect(exercise.getByRole('button', { name: 'Create training outline' })).toBeDisabled();
    await exercise.getByRole('button', { name: 'Record training bid', exact: true }).click();
    for (const checkbox of await exercise.getByRole('checkbox').all()) await checkbox.check();
    await exercise.getByRole('button', { name: 'Create training outline' }).click();
    await expect(exercise.getByRole('button', { name: 'Approve training version' })).toBeDisabled();
    const draft = exercise.getByLabel('Training response', { exact: true });
    await expect(draft).toHaveValue(/\[HUMAN INPUT REQUIRED\]/);
    await draft.fill(
      (await draft.inputValue()).replaceAll('[HUMAN INPUT REQUIRED]', 'Fictional exercise answer'),
    );
    await exercise.getByRole('button', { name: 'Approve training version' }).click();
    await exercise.getByRole('checkbox').first().uncheck();
    await expect(exercise.getByRole('button', { name: 'Record fictional submission' })).toBeDisabled();
    await exercise.getByRole('checkbox').first().check();
    await exercise.getByRole('button', { name: 'Approve training version' }).click();
    await exercise.getByLabel('Fictional confirmation number').fill('DEMO-RECEIPT');
    await exercise.getByRole('button', { name: 'Record fictional submission' }).click();
    await expect(exercise).toContainText('Historical user-recorded submission:');
    await draft.fill((await draft.inputValue()) + '\nEdited practice text');
    await expect(
      exercise.getByRole('button', { name: 'Record fictional submission' }),
    ).toBeDisabled();
    await exercise.getByRole('button', { name: 'Approve training version' }).click();
    await exercise.getByRole('button', { name: 'Simulate insurance expiration' }).click();
    await expect(exercise).toContainText('Decision: Stale bid');
    await expect(
      exercise.getByRole('button', { name: 'Record fictional submission' }),
    ).toBeDisabled();
    await expect(exercise).toContainText('General liability insurance — needs review');
    await exercise.getByRole('button', { name: 'Simulate an amendment' }).click();
    await expect(
      exercise.getByRole('button', { name: 'Sign off training register' }),
    ).toBeDisabled();
    await expect(exercise).toContainText('DEMO-RECEIPT');
    await exercise
      .locator('summary')
      .filter({ hasText: /^Exercise history/ })
      .click();
    await expect(exercise).toContainText('Alex approved fictional version');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.reload();
    await expect(exercise).toContainText('Decision: Not recorded');
    await expect(exercise).not.toContainText('DEMO-RECEIPT');
  });
}
