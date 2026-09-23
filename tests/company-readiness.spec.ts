import { test, expect } from '@playwright/test';
import {
  companyReadiness,
  reviewStatus,
  daysUntilExpiration,
  renewalQueue,
} from '../apps/web/lib/company-readiness';
import type { Fact } from '../apps/web/lib/tenant-types';
import { companyReview } from '../apps/web/lib/company-review';
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
  expiration_date: '2027-10-01',
  effective_date: '2026-09-01',
  updated_at: asOf,
};

test('guided review prioritizes expired and core evidence without attesting website claims', () => {
  const website = {
    ...fact,
    id: 'website',
    fact_type: 'capability',
    label: 'Appliance services',
    verification_status: 'pending_verification',
    verified_by: null,
    verified_at: null,
  };
  const missing = { ...website, id: 'license', fact_type: 'license', source_reference: null };
  const expired = { ...fact, id: 'expired', fact_type: 'insurance', expiration_date: '2026-09-18' };
  const input = [website, missing, fact, expired];
  const snapshot = JSON.stringify(input);
  const result = companyReview(input, asOf);
  expect(result.queue.map((item) => item.fact.id)).toEqual(['expired', 'license', 'website']);
  expect(result.queue[1].reasons).toContain('Add a supporting source reference.');
  expect(result.queue[2].reasons.join(' ')).toContain('attest');
  expect(result.missing.some((item) => item.label === 'DIR public-works registration')).toBe(true);
  expect(JSON.stringify(input)).toBe(snapshot);
  expect(companyReview([], asOf).queue).toEqual([]);
  expect(companyReview([], asOf).missing.length).toBeGreaterThan(0);
});
test('expired or future-effective evidence cannot remain reviewed because of its saved status', () => {
  expect(reviewStatus({ ...fact, expiration_date: '2026-09-18' }, asOf)).toBe('expired');
  expect(reviewStatus({ ...fact, effective_date: '2026-09-20' }, asOf)).toBe('not_yet_effective');
  expect(reviewStatus({ ...fact, expiration_date: '2026-09-19' }, asOf)).toBe('expiring');
});

test('renewal boundaries use calendar dates and never turn unverified evidence into reviewed evidence', () => {
  expect(daysUntilExpiration('2026-11-18', asOf)).toBe(60);
  expect(daysUntilExpiration('2026-11-19', asOf)).toBe(61);
  expect(daysUntilExpiration('2026-02-30', asOf)).toBeNull();
  expect(daysUntilExpiration(null, asOf)).toBeNull();
  expect(reviewStatus({ ...fact, expiration_date: '2026-11-18' }, asOf)).toBe('expiring');
  expect(reviewStatus({ ...fact, expiration_date: '2026-11-19' }, asOf)).toBe('reviewed');
  expect(
    reviewStatus(
      { ...fact, expiration_date: '2026-10-01', verification_status: 'pending_verification' },
      asOf,
    ),
  ).toBe('needs_review');
  expect(reviewStatus({ ...fact, expiration_date: 'bad' }, asOf)).toBe('needs_review');
  const rows = [
    { ...fact, id: 'soon', expiration_date: '2026-10-01' },
    { ...fact, id: 'expired', expiration_date: '2026-09-18' },
    { ...fact, id: 'later', expiration_date: '2026-11-19' },
    { ...fact, id: 'unknown', expiration_date: null },
  ];
  expect(renewalQueue(rows, asOf).map(({ fact }) => fact.id)).toEqual(['expired', 'soon']);
  expect(rows[0].id).toBe('soon');
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
