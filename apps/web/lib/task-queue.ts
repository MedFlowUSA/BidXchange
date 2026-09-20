import type { TenantData } from './tenant-types';
export function taskQueue(
  tasks: TenantData['tasks'],
  userId: string,
  mineOnly: boolean,
  asOf: string,
) {
  const now = Date.parse(asOf);
  return tasks
    .filter((t) => t.status !== 'complete' && (!mineOnly || t.assigned_user_id === userId))
    .map((task) => {
      const parsed = task.due_at ? Date.parse(task.due_at) : NaN;
      const due = Number.isFinite(parsed) ? parsed : null;
      return { task, due, overdue: due !== null && Number.isFinite(now) && due < now };
    })
    .sort(
      (a, b) => (a.due ?? Infinity) - (b.due ?? Infinity) || a.task.id.localeCompare(b.task.id),
    );
}
