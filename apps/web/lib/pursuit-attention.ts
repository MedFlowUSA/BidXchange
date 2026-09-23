import type { TenantData } from './tenant-types';
import { displayDate } from './ai/policy';
import type { NextAction } from './workspace-guide';

export function pursuitAttention(data: TenantData, pursuitId: string, action: NextAction) {
  const pursuit = data.pursuits.find((p) => p.id === pursuitId);
  if (!pursuit) return null;
  const opportunity = data.opportunities.find((o) => o.id === pursuit.opportunity_id);
  const requirements = (data.requirements ?? []).filter((r) => r.pursuit_id === pursuitId);
  const tasks = data.tasks.filter(
    (t) => t.pursuit_id === pursuitId && !['complete', 'done'].includes(t.status),
  );
  const now = Date.parse(data.reviewAsOf);
  const blockers = requirements.filter((r) =>
    data.resolutions?.some(
      (h) => h.requirement_id === r.id && h.review_current && h.disposition === 'blocked',
    ),
  ).length;
  const overdue = tasks.filter((t) => t.due_at && Date.parse(t.due_at) < now).length;
  const decision = data.decisions?.[0];
  const current = Boolean(
    decision && data.decisionContext && decision.context_token === data.decisionContext,
  );
  const decisionLabel = !decision
    ? 'No decision recorded'
    : !current
      ? 'Decision needs review'
      : decision.decision === 'no_bid'
        ? 'Current no-bid'
        : decision.decision === 'bid'
          ? 'Current bid decision'
          : 'Preliminary decision';
  const anchor = action.href.split('#')[1] ?? '';
  const task = tasks.find((t) => anchor === `task-${t.id}`);
  const requirement = requirements.find((r) => anchor === `requirement-${r.id}`);
  const assigned = task?.assigned_user_id ?? requirement?.owner_user_id;
  const member = data.members.find((m) => m.user_id === assigned && m.status === 'active');
  let owner = 'Capture manager or administrator';
  if (action.href.includes('/company?')) owner = 'Company administrator';
  if (task || requirement)
    owner = !assigned
      ? 'Unassigned — ask a capture manager to assign an owner'
      : !member
        ? 'Assigned member is inactive or unavailable'
        : assigned === data.userId
          ? 'You'
          : `Assigned ${member.role.replaceAll('_', ' ')} (member ${assigned.slice(0, 8)})`;
  else if (['bid-decision', 'register-signoff', 'response-release'].includes(anchor))
    owner = 'Authorized approver or administrator';
  return {
    blockers,
    overdue,
    openTasks: tasks.length,
    decisionLabel,
    owner,
    deadline: opportunity?.official_deadline
      ? displayDate(opportunity.official_deadline, opportunity.deadline_timezone)
      : 'Not recorded — confirm with the buyer',
    taskDue: task?.due_at
      ? displayDate(task.due_at, task.due_timezone ?? data.organization.default_timezone)
      : null,
    handoff: requirement
      ? 'The requirement owner coordinates follow-up; only an authorized reviewer can change its finding.'
      : null,
  };
}
