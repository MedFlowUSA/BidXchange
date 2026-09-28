import { test, expect } from '@playwright/test';
import { companyNextActions } from '../apps/web/lib/company-next-actions';
import { companySection } from '../apps/web/components/company-portal';
import { workflowData, user } from './fixtures/workflow-data';
import type { Fact } from '../apps/web/lib/tenant-types';

const fact = (id: string, changes: Partial<Fact> = {}): Fact => ({
  id,
  fact_type: 'insurance',
  label: `Synthetic ${id}`,
  value: 'Training only',
  verification_status: 'verified',
  verified_by: user,
  verified_at: '2026-09-20T00:00:00Z',
  expiration_date: '2027-09-20',
  source_reference: 'Synthetic source',
  source_note: null,
  updated_at: '2026-09-20T00:00:00Z',
  ...changes,
});

test('urgent company actions precede setup, avoid duplicate facts and point at existing records', () => {
  const data = workflowData();
  data.facts = [
    fact('expired', { expiration_date: '2026-09-01' }),
    fact('stale', { verified_at: '2026-01-01T00:00:00Z' }),
    fact('pending', { verification_status: 'pending_verification' }),
  ];
  data.onboarding = [
    {
      id: 'overdue',
      label: 'Bond letter requested',
      due_on: '2026-09-19',
      status: 'needs_information',
    },
  ];
  const result = companyNextActions(data);
  expect(result.actions.map((a) => a.href)).toEqual([
    '#fact-expired',
    '#information-request-overdue',
    '#fact-stale',
  ]);
  expect(result.renewalCount).toBe(2);
  expect(new Set(result.actions.map((a) => a.id)).size).toBe(result.actions.length);
});

test('source-check freshness wins over recent attestation and completed requests stay out', () => {
  const data = workflowData();
  data.facts = [fact('stale', { structured_fields: { last_checked: '2026-01-01' } })];
  data.onboarding = [
    { id: 'closed', label: 'Completed', due_on: '2026-01-01', status: 'complete' },
  ];
  const result = companyNextActions(data);
  expect(result.actions[0]).toMatchObject({
    label: 'Source needs rechecking',
    href: '#fact-stale',
  });
  expect(result.requests).toEqual([]);
});

test('renewals and visible human review appear before missing fields without inferring approval', () => {
  const data = workflowData();
  data.facts = [
    fact('renewal', { expiration_date: '2026-10-01' }),
    fact('license', { fact_type: 'license', verification_status: 'pending_verification' }),
  ];
  const result = companyNextActions(data);
  expect(result.actions.map((a) => a.label)).toEqual([
    'Renewal approaching',
    'Human review needed',
    'Profile fields missing',
  ]);
  expect(result.actions[0].href).toBe('#fact-renewal');
  expect(result.progress.percent).toBeLessThan(100);
});

test('empty and viewer snapshots provide actionable guidance without edit or attestation promises', () => {
  const data = workflowData('viewer');
  const empty = companyNextActions(data);
  expect(empty.progress.percent).toBe(0);
  expect(empty.actions[0]).toMatchObject({
    href: '#passport-identity',
    label: 'Profile fields missing',
  });
  expect(empty.actions[0].detail).toContain('administrator');
  data.facts = [fact('expired', { expiration_date: '2026-01-01' })];
  expect(companyNextActions(data).actions[0].detail).toContain(
    'Ask the record owner or administrator',
  );
});

test('pending request links reuse the request and recommendations never mutate the snapshot', () => {
  const data = workflowData();
  data.onboarding = [{ id: 'requested', label: 'Awaiting source', status: 'pending_review' }];
  const before = structuredClone(data);
  expect(companyNextActions(data).actions[0]).toMatchObject({
    label: 'Request ready for review',
    href: '#information-request-requested',
  });
  expect(data).toEqual(before);
});

test('hidden Decision Log and unknown fragments fall back to a populated overview', () => {
  expect(companySection('#company-decisions', false)).toBe('overview');
  expect(companySection('#company-decisions', true)).toBe('decisions');
  expect(companySection('#profile-completion-title')).toBe('overview');
  expect(companySection('#not-a-section')).toBe('overview');
  expect(companySection('#fact-example')).toBe('records');
});
