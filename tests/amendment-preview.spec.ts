import { test, expect } from '@playwright/test';
import { amendmentPreview } from '../apps/web/lib/amendment-preview';
import { readFileSync } from 'node:fs';

test('saved source hashes and amendment fields fit a phone before and after opening the editor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<main style="padding:18px"><section class="panel"><article class="panel" id="requirement-synthetic"><h3>General liability certificate</h3><p>Notice citation: Source SHA-256: ${'a'.repeat(64)}</p><details class="company-record-editor amendment-editor"><summary>Review an amendment</summary><form class="opportunity-form admin-form"><fieldset><legend>Amendment review</legend><div class="amendment-comparison"><div><h4>Saved requirement</h4><p>Source: https://example.gov/${'b'.repeat(120)}</p></div><label>Revised requirement<textarea rows="6">A current general liability certificate is required.</textarea></label></div></fieldset></form></details></article></section></main>`);
  await page.addStyleTag({ content: readFileSync('apps/web/app/globals.css', 'utf8') });
  for (const open of [false, true]) {
    if (open) await page.getByText('Review an amendment', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    if (open) {
      const box = await page.getByRole('textbox').boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    }
  }
});

test('changed spans reconstruct both versions without interpreting dates or numbers', () => {
  for (const [before, after] of [
    ['Due October 1.', 'Due October 12.'],
    ['License A required', 'License B required'],
    ['', 'Added'],
    ['Removed', ''],
    ['Same', 'Same'],
    ['A🙂B', 'A🙃B'],
    ['abXcdYef', 'abZcdQef'],
  ]) {
    const diff = amendmentPreview(before, after);
    expect(diff.prefix + diff.removed + diff.suffix).toBe(before);
    expect(diff.prefix + diff.inserted + diff.suffix).toBe(after);
    expect(diff.changed).toBe(before !== after);
  }
});

test('outer whitespace follows saved requirement normalization and literal markup stays text', () => {
  expect(amendmentPreview(' Requirement ', 'Requirement').changed).toBe(false);
  expect(amendmentPreview('', '<script>alert(1)</script>').inserted).toBe(
    '<script>alert(1)</script>',
  );
  const value = 'x'.repeat(4000);
  expect(amendmentPreview(value, value + 'a').inserted).toBe('a');
});
