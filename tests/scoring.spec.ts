import { test, expect } from '@playwright/test';
import { qualify, type Gate } from '../packages/scoring';
const passed: Gate = { name: 'License', status: 'pass', evidence: 'Fictional evidence' };
const factors = [{ name: 'Fit', score: 95, weight: 100 }];
test('fatal eligibility wins over a high score and unknown facts', () => {
  expect(
    qualify(
      [
        { ...passed, status: 'fail' },
        { ...passed, status: 'unknown' },
      ],
      factors,
    ),
  ).toEqual({ score: null, band: 'Not eligible' });
});
test('missing or unknown eligibility never implies qualification', () => {
  expect(qualify([], factors).score).toBeNull();
  expect(qualify([{ ...passed, status: 'unknown' }], factors).score).toBeNull();
});
test('weighted scoring is deterministic after all gates pass', () => {
  expect(
    qualify(
      [passed],
      [
        { name: 'Scope', score: 100, weight: 60 },
        { name: 'Capacity', score: 50, weight: 40 },
      ],
    ),
  ).toEqual({ score: 80, band: 'Strong fit' });
});
test('invalid or absent scoring inputs stay unqualified', () => {
  expect(qualify([passed], []).score).toBeNull();
  expect(qualify([passed], [{ name: 'Invalid', score: 120, weight: 1 }]).score).toBeNull();
  expect(qualify([passed], [{ name: 'Invalid', score: 50, weight: 0 }]).score).toBeNull();
});
