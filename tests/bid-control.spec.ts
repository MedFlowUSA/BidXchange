import { test, expect } from '@playwright/test';
import { bidControl } from '../apps/web/lib/bid-control';
import { workflowData, pursuit, user } from './fixtures/workflow-data';

test('bid control excludes unrelated and completed tasks and preserves unknown dates', () => {
  const data = workflowData();
  data.tasks = [
    {
      id: 'late',
      pursuit_id: pursuit,
      title: 'Request bond',
      status: 'todo',
      due_at: '2026-09-20T10:00:00-07:00',
      due_timezone: 'America/Los_Angeles',
      assigned_user_id: user,
    },
    { id: 'missing', pursuit_id: pursuit, title: 'Confirm job walk', status: 'todo' },
    {
      id: 'bad',
      pursuit_id: pursuit,
      title: 'Confirm time zone',
      status: 'todo',
      due_at: '2026-09-22T10:00:00Z',
      due_timezone: 'invalid',
    },
    {
      id: 'done',
      pursuit_id: pursuit,
      title: 'Done',
      status: 'complete',
      due_at: '2026-09-01T10:00:00Z',
    },
    { id: 'foreign', pursuit_id: 'other', title: 'OTHER PURSUIT', status: 'todo' },
  ];
  const snapshot = JSON.stringify(data);
  const result = bidControl(data, pursuit);
  expect(result.open).toHaveLength(3);
  expect(result.overdue).toBe(1);
  expect(result.unassigned).toBe(2);
  expect(result.dates.find((d) => d.id === 'missing')?.time).toBeNull();
  expect(result.dates.find((d) => d.id === 'bad')?.label).toContain('confirm the time zone');
  expect(JSON.stringify(result)).not.toContain('OTHER PURSUIT');
  expect(result.dates.some((d) => d.id === 'done')).toBe(false);
  expect(JSON.stringify(data)).toBe(snapshot);
  expect(bidControl(data, 'missing-pursuit').dates).toEqual([]);
});

test('decision and sign-off states require available matching context; invalid dates remain unknown', () => {
  const data = workflowData();
  data.decisionsEnabled = true;
  data.registerSignoffsEnabled = true;
  data.decisionContext = 'new';
  data.decisions = [
    {
      id: 'memo',
      decision: 'bid',
      reason: 'Synthetic',
      conditions: '',
      context_token: 'old',
      decided_by: user,
      decided_at: data.reviewAsOf,
    },
  ];
  data.registerSignoffs = [
    {
      id: 'signoff',
      context_token: 'old',
      note: 'Synthetic',
      signed_off_by: user,
      signed_off_at: data.reviewAsOf,
      requirement_count: 1,
      blocker_count: 0,
    },
  ];
  expect(bidControl(data, pursuit).decisionState).toContain('Stale');
  expect(bidControl(data, pursuit).signoff).toContain('Changed');
  data.decisionContext = 'old';
  expect(bidControl(data, pursuit).decisionState).toBe('Current recorded memo');
  expect(bidControl(data, pursuit).signoff).toBe('Current human sign-off');
  data.decisionsEnabled = false;
  expect(bidControl(data, pursuit).decisionState).toBe('Review unavailable');
  data.opportunities[0].official_deadline = '2026-02-30T12:00:00Z';
  expect(bidControl(data, pursuit).dates[0].time).toBeNull();
});
