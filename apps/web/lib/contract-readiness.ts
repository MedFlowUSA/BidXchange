import type { TenantData } from './tenant-types';
import { qualificationMap } from './qualification-map';

// A projection of the caller's authorized snapshot, never a win or eligibility score.
export function contractReadiness(data: TenantData, pursuitId: string) {
  if (!data.pursuits.some((p) => p.id === pursuitId)) return null;
  const map = qualificationMap(data, pursuitId);
  const now = Date.parse(data.reviewAsOf);
  const tasks = data.tasks.filter((t) => t.pursuit_id === pursuitId && t.status !== 'complete');
  const actions = tasks
    .map((task) => ({
      ...task,
      overdue: !!task.due_at && Date.parse(task.due_at) < now,
      unassigned: !task.assigned_user_id,
      missingDeadline: !task.due_at || !Number.isFinite(Date.parse(task.due_at)),
    }))
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        Number(b.unassigned) - Number(a.unassigned) ||
        (Date.parse(a.due_at ?? '') || Infinity) - (Date.parse(b.due_at ?? '') || Infinity) ||
        a.id.localeCompare(b.id),
    );
  const changed = map.rows.filter((r) =>
    r.answers.some((a) => a.sourceChanged || a.contextChanged),
  );
  const pendingSource =
    data.sourceProvenance?.some(
      (s) => s.opportunity_id === map.opportunity?.id && s.change_pending,
    ) ?? false;
  return {
    map,
    actions,
    changed,
    pendingSource,
    supported: map.rows.filter((r) => r.resolved).length,
    uncertain:
      data.tasks.length >= 500 ||
      !map.rows.length ||
      map.partial ||
      map.unavailable ||
      map.hiddenEvidence ||
      map.unreadableDrafts,
    overdue: actions.filter((t) => t.overdue).length,
    unassigned: actions.filter((t) => t.unassigned).length,
  };
}
