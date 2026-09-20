import { test, expect } from '@playwright/test';
import { companyReadiness, reviewStatus } from '../apps/web/lib/company-readiness';
import type { Fact } from '../apps/web/lib/tenant-types';
const asOf = '2026-09-19T12:00:00Z';
const fact: Fact = {
  id: 'synthetic',
  fact_type: 'license',
  label: 'Synthetic license',
  value: 'Synthetic value',
  verification_status: 'verified',
  source_reference: 'Synthetic evidence',
  source_note: null,
  verified_by: 'synthetic-reviewer',
  verified_at: '2026-09-01T12:00:00Z',
  expiration_date: '2026-10-01',
  effective_date: '2026-09-01',
  updated_at: asOf,
};
test('expired or future-effective evidence cannot remain reviewed because of its saved status', () => {
  expect(reviewStatus({ ...fact, expiration_date: '2026-09-18' }, asOf)).toBe('expired');
  expect(reviewStatus({ ...fact, effective_date: '2026-09-20' }, asOf)).toBe('not_yet_effective');
  expect(reviewStatus({ ...fact, expiration_date: '2026-09-19' }, asOf)).toBe('reviewed');
});
test('a verified label without a value, source or human verification requires review', () => {
  for (const change of [
    { value: ' ' },
    { source_reference: null },
    { verified_by: null },
    { verified_at: null },
  ])
    expect(reviewStatus({ ...fact, ...change }, asOf)).toBe('needs_review');
  expect(reviewStatus({ ...fact, verification_status: 'pending_verification' }, asOf)).toBe(
    'needs_review',
  );
  expect(reviewStatus({ ...fact, verification_status: 'expiring' }, asOf)).toBe('expiring');
});
test('next action prioritizes expired evidence and does not mutate the supplied facts', () => {
  const input = [
    fact,
    { ...fact, id: 'pending', verification_status: 'unverified' },
    { ...fact, id: 'expired', expiration_date: '2026-09-18' },
  ];
  expect(companyReadiness(input, asOf).needingReview.map((f) => f.id)).toEqual([
    'expired',
    'pending',
  ]);
  expect(input[0]).toBe(fact);
});
test('legacy categories remain grouped and unknown categories remain available for review', () => {
  const model = companyReadiness(
    [
      { ...fact, fact_type: 'federal' },
      { ...fact, id: 'territory', fact_type: 'territory' },
      { ...fact, id: 'other', fact_type: 'custom' },
    ],
    asOf,
  );
  expect(model.groups.find((g) => g.id === 'registrations')?.facts).toHaveLength(1);
  expect(model.groups.find((g) => g.id === 'territory')?.facts).toHaveLength(1);
  expect(model.other.map((f) => f.id)).toEqual(['other']);
});
test('an empty authorized view does not infer missing private records or company eligibility', () => {
  const model = companyReadiness([], asOf);
  expect(model.needingReview).toEqual([]);
  expect(model.groups.every((g) => g.facts.length === 0)).toBe(true);
  expect(model).not.toHaveProperty('score');
  expect(model).not.toHaveProperty('eligible');
});
