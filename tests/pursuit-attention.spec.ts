import { test, expect } from '@playwright/test';
import { workflowData, pursuit } from './fixtures/workflow-data';
import { nextActions } from '../apps/web/lib/workspace-guide';
import { pursuitAttention } from '../apps/web/lib/pursuit-attention';
test('confirmed blockers outrank generic reviews and summary excludes other pursuits', () => {
  const d = workflowData();
  d.opportunities[0].official_deadline = '2099-01-01T00:00:00Z';
  d.requirements!.push({ ...d.requirements![0], id: 'blocker', owner_user_id: d.userId });
  d.resolutions = [
    {
      id: 'finding',
      requirement_id: 'blocker',
      disposition: 'blocked',
      reason: 'Human finding',
      authority_name: '',
      authority_reference: '',
      reviewed_by: d.userId,
      reviewed_at: d.reviewAsOf,
      review_current: true,
    },
  ];
  d.tasks = [
    {
      id: 'other-task',
      pursuit_id: 'other',
      title: 'Other company task',
      status: 'todo',
      due_at: '2020-01-01T00:00:00Z',
    },
  ];
  const action = nextActions(d, 'Pursuits', pursuit)[0];
  expect(action.href).toContain('#requirement-blocker');
  const summary = pursuitAttention(d, pursuit, action)!;
  expect(summary.blockers).toBe(1);
  expect(summary.openTasks).toBe(0);
  expect(summary.owner).toBe('You');
  d.opportunities[0].official_deadline = null;
  expect(pursuitAttention(d, pursuit, action)!.deadline).toContain('Not recorded');
  expect(nextActions(d, 'Pursuits', pursuit)[0].title).toBe('Confirm the official notice details');
  expect(pursuitAttention(d, 'unavailable', action)).toBeNull();
  d.resolutions[0].review_current = false;
  expect(pursuitAttention(d, pursuit, action)!.blockers).toBe(0);
});
test('amendments and stale decisions surface before routine work; overdue tasks link to their owner', () => {
  const d = workflowData();
  d.opportunities[0].official_deadline = '2099-01-01T00:00:00Z';
  d.tasks = [
    {
      id: 'late',
      pursuit_id: pursuit,
      title: 'Request bond letter',
      status: 'todo',
      due_at: '2026-09-20T00:00:00Z',
      assigned_user_id: d.userId,
    },
  ];
  let action = nextActions(d, 'Pursuits', pursuit)[0];
  expect(action.href).toContain('#task-late');
  expect(pursuitAttention(d, pursuit, action)!.overdue).toBe(1);
  d.decisions = [
    {
      id: 'd',
      decision: 'bid',
      context_token: 'old',
      reason: '',
      conditions: '',
      decided_by: d.userId,
      decided_at: d.reviewAsOf,
    },
  ];
  d.decisionContext = 'new';
  action = nextActions(d, 'Pursuits', pursuit)[0];
  expect(action.href).toContain('#bid-decision');
  expect(pursuitAttention(d, pursuit, action)!.decisionLabel).toBe('Decision needs review');
  d.amendments = [
    {
      id: 'a',
      updated_at: d.reviewAsOf,
      label: 'Addendum 1',
      issued_on: null,
      source_url: 'https://example.invalid',
      summary: '',
      reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
    },
  ];
  expect(nextActions(d, 'Pursuits', pursuit)[0].href).toContain('#opportunity-amendments');
  expect(nextActions(d, 'Pursuits', 'unavailable')).toHaveLength(1);
});
