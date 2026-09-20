import { test, expect } from '@playwright/test';
import { amendmentPreview } from '../apps/web/lib/amendment-preview';

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
