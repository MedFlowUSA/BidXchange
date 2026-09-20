import { test, expect } from '@playwright/test';
import { taskQueue } from '../apps/web/lib/task-queue';
test('task queue prioritizes due dates, excludes completed work and filters owner without mutation', () => {
  const base = { pursuit_id: 'p', title: 'Task', status: 'todo' };
  const tasks = [
    { ...base, id: 'undated', due_at: 'invalid' },
    { ...base, id: 'later', due_at: '2026-10-01T00:00:00Z', assigned_user_id: 'me' },
    { ...base, id: 'late', due_at: '2026-09-01T00:00:00Z' },
    { ...base, id: 'done', status: 'complete', due_at: '2026-01-01T00:00:00Z' },
  ];
  const rows = taskQueue(tasks, 'me', false, '2026-09-20T00:00:00Z');
  expect(rows.map((r) => r.task.id)).toEqual(['late', 'later', 'undated']);
  expect(rows.map((r) => r.overdue)).toEqual([true, false, false]);
  expect(taskQueue(tasks, 'me', true, '2026-09-20T00:00:00Z').map((r) => r.task.id)).toEqual([
    'later',
  ]);
  expect(tasks[0].id).toBe('undated');
});
