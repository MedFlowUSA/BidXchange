import { test, expect } from '@playwright/test';
import {
  informationRequestInput,
  informationRequestQueue,
} from '../apps/web/lib/information-requests';
import { qualificationData } from './fixtures/qualification-data';
const valid = {
  organization_id: '10000000-0000-4000-8000-000000000001',
  record_id: '',
  updated_at: '',
  label: 'Collect dates',
  assigned_user_id: '10000000-0000-4000-8000-000000000002',
  due_on: '2026-10-01',
  status: 'needs_information',
  notes: '',
  passport_section: 'coverage',
  passport_item: 'General liability insurance',
};
test('new requests need an owner, date, and complete Passport link', () => {
  expect(informationRequestInput.safeParse(valid).success).toBe(true);
  for (const change of [
    { assigned_user_id: '' },
    { due_on: '' },
    { passport_item: '' },
    { status: 'complete' },
    { due_on: '2026-02-30' },
  ])
    expect(informationRequestInput.safeParse({ ...valid, ...change }).success).toBe(false);
});
test('review and closure require explanation and a current record version', () => {
  const edit = {
    ...valid,
    record_id: valid.organization_id,
    updated_at: '2026-09-22T12:00:00.123456Z',
    status: 'pending_review',
  };
  expect(informationRequestInput.safeParse(edit).success).toBe(false);
  expect(informationRequestInput.safeParse({ ...edit, notes: 'Dates entered' }).success).toBe(true);
  expect(
    informationRequestInput.safeParse({ ...edit, notes: 'Dates entered', updated_at: '' }).success,
  ).toBe(false);
});
test('queue uses company local date and never marks closed requests overdue', () => {
  const data = qualificationData();
  data.reviewAsOf = '2026-09-22T02:00:00Z';
  data.organization.default_timezone = 'America/Los_Angeles';
  data.onboarding = [
    { id: '1', label: 'Today', status: 'needs_information', due_on: '2026-09-21' },
    { id: '2', label: 'Late', status: 'pending_review', due_on: '2026-09-20' },
    { id: '3', label: 'Closed', status: 'complete', due_on: '2026-09-01' },
  ];
  const rows = informationRequestQueue(data);
  expect(rows.map((r) => r.id)).toEqual(['2', '1', '3']);
  expect(rows.map((r) => r.overdue)).toEqual([true, false, false]);
});
