import { test, expect } from '@playwright/test';
import { contractReadiness } from '../apps/web/lib/contract-readiness';
import { qualificationData } from './fixtures/qualification-data';
import { pursuit } from './fixtures/workflow-data';

test('readiness preserves blockers, unknowns and authorized pursuit boundaries', () => {
  const data = qualificationData();
  const before = JSON.stringify(data);
  expect(contractReadiness(data, pursuit)?.map.blocked).toBe(1);
  expect(contractReadiness(data, 'inaccessible')).toBeNull();
  expect(JSON.stringify(data)).toBe(before);
  data.tasks = Array.from({ length: 500 }, (_, i) => ({
    id: String(i),
    pursuit_id: pursuit,
    title: 'Review',
    status: 'complete',
  }));
  expect(contractReadiness(data, pursuit)?.uncertain).toBe(true);
  data.facts = [];
  expect(contractReadiness(data, pursuit)?.uncertain).toBe(true);
  data.requirements = [];
  expect(contractReadiness(data, pursuit)?.uncertain).toBe(true);
});

test('prioritizes overdue and unassigned work without treating finished or foreign tasks as open', () => {
  const data = qualificationData();
  data.tasks = [
    {
      id: 'late',
      pursuit_id: pursuit,
      title: 'Late quote',
      status: 'todo',
      assigned_user_id: data.userId,
      due_at: '2020-01-01T00:00:00Z',
    },
    {
      id: 'unknown',
      pursuit_id: pursuit,
      title: 'Assign review',
      status: 'todo',
      due_at: 'invalid',
    },
    { id: 'done', pursuit_id: pursuit, title: 'Complete', status: 'complete' },
    { id: 'foreign', pursuit_id: 'another', title: 'Other pursuit', status: 'todo' },
  ];
  const brief = contractReadiness(data, pursuit)!;
  expect(brief.actions.map((t) => t.id)).toEqual(['late', 'unknown']);
  expect(brief.overdue).toBe(1);
  expect(brief.unassigned).toBe(1);
  expect(brief.actions[1].missingDeadline).toBe(true);
});

test('source updates and changed response context remain visible without claiming live monitoring', () => {
  const data = qualificationData();
  data.sourceProvenance = [
    { opportunity_id: data.pursuits[0].opportunity_id, change_pending: true },
  ];
  data.decisionContext = 'changed';
  const brief = contractReadiness(data, pursuit)!;
  expect(brief.pendingSource).toBe(true);
  expect(brief.changed.length).toBeGreaterThan(0);
  data.sourceProvenance = [{ opportunity_id: 'another', change_pending: true }];
  expect(contractReadiness(data, pursuit)?.pendingSource).toBe(false);
});
