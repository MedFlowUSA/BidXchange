import { test, expect } from '@playwright/test';
import { companyRecordInput } from '../apps/web/lib/company-record-input';
const record = {
  organization_id: '10000000-0000-4000-8000-000000000001',
  fact_id: '',
  updated_at: '',
  fact_type: 'license',
  label: 'Synthetic license',
  value: '',
  source_reference: '',
  source_note: '',
  owner_user_id: '10000000-0000-4000-8000-000000000002',
  effective_date: '',
  expiration_date: '',
  sensitivity: 'restricted',
};
test('company evidence permits honest unknown values but rejects malformed dates and stale-write omissions', () => {
  expect(companyRecordInput.safeParse(record).success).toBe(true);
  for (const change of [
    { fact_type: 'arbitrary' },
    { label: ' ' },
    { effective_date: '2026-02-30' },
    { effective_date: '2026-10-01', expiration_date: '2026-01-01' },
    { fact_id: '10000000-0000-4000-8000-000000000003' },
    { updated_at: '2026-09-19T12:00:00Z' },
    { owner_user_id: 'not-a-user' },
    { value: 'x'.repeat(4001) },
  ])
    expect(companyRecordInput.safeParse({ ...record, ...change }).success).toBe(false);
});
test('restricted categories cannot be reclassified through the evidence form and browser verification fields are dropped', () => {
  for (const fact_type of [
    'insurance',
    'bonding',
    'personnel',
    'financial',
    'safety',
    'past_performance',
  ])
    expect(
      companyRecordInput.safeParse({ ...record, fact_type, sensitivity: 'workspace' }).success,
    ).toBe(false);
  expect(companyRecordInput.safeParse({ ...record, sensitivity: 'workspace' }).success).toBe(true);
  expect(
    companyRecordInput.parse({
      ...record,
      verification_status: 'verified',
      verified_by: record.owner_user_id,
      company_profile_id: 'foreign',
    }),
  ).toEqual(record);
});
