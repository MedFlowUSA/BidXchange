import { expect, test } from '@playwright/test';
import {
  opportunityInput,
  taskInput,
  pursuitInput,
  requirementInput,
} from '../apps/web/lib/capture-input';
const org = '10000000-0000-4000-8000-000000000001';
test('requirements need citations and versioned edits; no approved state or browser authority is accepted', () => {
  const record = {
    organization_id: org,
    pursuit_id: org,
    record_id: '',
    updated_at: '',
    requirement: 'Provide a bid bond',
    citation: 'Notice section 4.2, page 18',
    owner_user_id: '',
    status: 'missing_information',
  };
  expect(requirementInput.parse({ ...record, verified_by: org, decision: 'bid' })).toEqual(record);
  for (const change of [
    { citation: ' ' },
    { requirement: '' },
    { requirement: 'x'.repeat(4001) },
    { status: 'compliant' },
    { status: 'approved' },
    { record_id: org },
    { owner_user_id: 'foreign' },
    { pursuit_id: '' },
  ])
    expect(requirementInput.safeParse({ ...record, ...change }).success).toBe(false);
});
const opportunity = {
  organization_id: org,
  record_id: '',
  updated_at: '',
  title: 'Notice',
  buyer: '',
  solicitation_number: '',
  source_url: '',
  source_note: 'Notice supplied by buyer; review needed',
  summary: '',
  official_deadline: '',
  deadline_timezone: 'America/Los_Angeles',
};
test('opportunity intake requires a traceable source and unambiguous dates; strips authority fields', () => {
  expect(
    opportunityInput.parse({
      ...opportunity,
      decision: 'bid',
      status: 'awarded',
      estimated_value: 999,
    }),
  ).toEqual(opportunity);
  for (const change of [
    { source_note: '' },
    { source_url: 'javascript:alert(1)' },
    { source_url: 'file:///private' },
    { official_deadline: '2026-10-15T14:00' },
    { official_deadline: '2026-02-30T14:00:00Z' },
    { deadline_timezone: 'Pacific-ish' },
    { record_id: org },
    { updated_at: '2026-09-19T12:00:00Z' },
    { title: ' ' },
    { summary: 'x'.repeat(6001) },
    { organization_id: 'foreign' },
  ])
    expect(opportunityInput.safeParse({ ...opportunity, ...change }).success).toBe(false);
  expect(
    opportunityInput.safeParse({ ...opportunity, official_deadline: '2026-10-15T14:00:00-07:00' })
      .success,
  ).toBe(true);
});
test('task edits require a version, valid parent and owner identifiers; cannot carry bid authority', () => {
  const task = {
    organization_id: org,
    record_id: '',
    updated_at: '',
    title: 'Review notice',
    pursuit_id: org,
    status: 'todo',
    assigned_user_id: '',
    due_at: '',
    due_timezone: 'UTC',
  };
  expect(taskInput.parse({ ...task, decision: 'bid', submitted_at: 'now' })).toEqual(task);
  for (const change of [
    { record_id: org },
    { assigned_user_id: 'foreign' },
    { pursuit_id: '' },
    { status: 'approved' },
    { due_at: 'tomorrow' },
    { due_timezone: '' },
  ])
    expect(taskInput.safeParse({ ...task, ...change }).success).toBe(false);
  expect(
    pursuitInput.parse({ organization_id: org, opportunity_id: org, decision: 'bid' }),
  ).toEqual({ organization_id: org, opportunity_id: org });
});
