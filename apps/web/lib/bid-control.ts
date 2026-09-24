import { z } from 'zod';
import type { TenantData } from './tenant-types';
import { hasCurrentRegisterSignoff } from './workspace-guide';

export function bidControl(data: TenantData, pursuitId: string) {
  const pursuit = data.pursuits.find((p) => p.id === pursuitId);
  const opportunity = data.opportunities.find((o) => o.id === pursuit?.opportunity_id);
  const tasks = pursuit ? data.tasks.filter((t) => t.pursuit_id === pursuitId) : [];
  const open = tasks.filter((t) => t.status !== 'complete');
  const active = new Set(data.members.filter((m) => m.status === 'active').map((m) => m.user_id));
  const now = Date.parse(data.reviewAsOf);
  const timestamp = (value: string | null | undefined) =>
    value && z.iso.datetime({ offset: true }).safeParse(value).success ? Date.parse(value) : null;
  const dates = [
    ...(opportunity
      ? [
          {
            id: 'submission',
            title: 'Recorded submission deadline',
            at: opportunity.official_deadline,
            zone: opportunity.deadline_timezone,
            taskId: null as string | null,
          },
        ]
      : []),
    ...open.map((t) => ({
      id: t.id,
      title: t.title,
      at: t.due_at,
      zone: t.due_timezone,
      taskId: t.id,
    })),
  ]
    .map((item) => {
      const time = timestamp(item.at);
      let label = 'Date not recorded or invalid';
      let zoneValid = false;
      if (time !== null && item.zone) {
        try {
          label =
            new Intl.DateTimeFormat('en-US', {
              timeZone: item.zone,
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(time) + ` (${item.zone})`;
          zoneValid = true;
        } catch {
          /* A bad time zone must not silently become UTC. */
        }
      }
      if (time !== null && !zoneValid) label = `${item.at} — confirm the time zone`;
      return {
        ...item,
        time,
        label,
        needsDateReview: time === null || !zoneValid,
        overdue: time !== null && Number.isFinite(now) && time < now,
      };
    })
    .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity) || a.id.localeCompare(b.id));
  const latest = pursuit ? data.decisions?.[0] : undefined;
  const submission = dates.find((item) => item.taskId === null);
  const taskDates = dates
    .filter((item) => item.taskId !== null)
    .map((item) => {
      const task = open.find((task) => task.id === item.taskId)!;
      return {
        ...item,
        needsOwner: !task.assigned_user_id || !active.has(task.assigned_user_id),
        atOrAfterSubmission:
          !!submission &&
          !submission.needsDateReview &&
          !item.needsDateReview &&
          item.time! >= submission.time!,
      };
    });
  const decisionState = !data.decisionsEnabled
    ? 'Review unavailable'
    : !latest
      ? 'No decision memo recorded'
      : !data.decisionContext || latest.context_token !== data.decisionContext
        ? 'Stale — human reaffirmation needed'
        : 'Current recorded memo';
  return {
    tasks,
    open,
    dates,
    submission,
    taskDates,
    overdue: dates.filter((d) => d.taskId && d.overdue).length,
    unassigned: open.filter((t) => !t.assigned_user_id || !active.has(t.assigned_user_id)).length,
    decision: latest?.preliminary_state || latest?.decision || pursuit?.decision || 'Unknown',
    decisionState,
    signoff:
      !pursuit || !data.registerSignoffsEnabled
        ? 'Review unavailable'
        : hasCurrentRegisterSignoff(data)
          ? 'Current human sign-off'
          : data.registerSignoffs?.length
            ? 'Changed — sign off again after review'
            : 'Not signed off',
    partial: data.tasks.length >= 500,
  };
}
