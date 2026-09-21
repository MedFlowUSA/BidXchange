import type { TenantData } from './tenant-types';
import { pursuitBrief } from './pursuit-brief';

export function bidReview(data: TenantData, pursuitId: string) {
  const brief = pursuitBrief(data, pursuitId);
  const tasks = data.tasks.filter((t) => t.pursuit_id === pursuitId && t.status !== 'complete');
  const latest = data.decisionsEnabled ? data.decisions?.[0] : undefined;
  const staleDecision = Boolean(
    latest && (!data.decisionContext || latest.context_token !== data.decisionContext),
  );
  const unresolved = brief.rows.filter((r) => !r.resolved);
  const missingOwners = brief.rows.filter((r) => !r.requirement.owner_user_id);
  const next = !brief.rows.length
    ? {
        label: 'Read the notice and record its requirements',
        href: ['organization_admin', 'capture_manager'].includes(data.organization.role)
          ? '#notice-intake'
          : '#requirements-heading',
      }
    : unresolved.length
      ? {
          label: `Review ${unresolved[0].requirement.requirement}`,
          href: `#requirement-${unresolved[0].requirement.id}`,
        }
      : missingOwners.length
        ? {
            label: 'Assign a reviewer to each requirement',
            href: `#requirement-${missingOwners[0].requirement.id}`,
          }
        : brief.rows.some((r) => r.issues.length)
          ? { label: 'Resolve the remaining review gaps', href: '#decision-brief-heading' }
          : tasks.length
            ? { label: 'Review open pursuit actions', href: '#pursuit-tasks' }
            : {
                label: staleDecision
                  ? 'Revisit the decision after changes'
                  : 'Review the human bid/no-bid decision',
                href: '#bid-decision',
              };
  return { ...brief, tasks, latest, staleDecision, unresolved, missingOwners, next };
}

export function bidReviewText(data: TenantData, pursuitId: string) {
  const review = bidReview(data, pursuitId);
  const pursuit = data.pursuits.find((p) => p.id === pursuitId);
  const opportunity = data.opportunities.find((o) => o.id === pursuit?.opportunity_id);
  return [
    `BidXchange bid review: ${pursuit?.title ?? 'Pursuit'}`,
    `Workspace: ${data.organization.operating_name}`,
    `Visible records as of ${data.reviewAsOf}. Refresh before deciding.`,
    'This export contains workspace information. Share only with authorized recipients.',
    'This is a review aid, not an eligibility finding or submission authorization. Restricted records may be outside this view.',
    review.partial
      ? 'PARTIAL: a requirement or evidence limit was reached.'
      : 'Only the visible saved register is included; completeness of the source notice has not been established.',
    `Source: ${opportunity?.source_url ?? opportunity?.source_note ?? 'Not recorded'}`,
    `Next review: ${review.next.label}`,
    '',
    ...review.rows.flatMap(({ requirement, issues, resolution, approved }) => [
      `REQUIREMENT: ${requirement.requirement}`,
      `Citation: ${requirement.citation ?? 'Not recorded'}`,
      `Owner: ${requirement.owner_user_id ?? 'Unassigned'}`,
      `Human finding: ${resolution ? `${resolution.disposition}; ${resolution.review_current ? 'current' : 'review again'}` : 'Not visible or not recorded'}`,
      `Current evidence approvals visible: ${approved}`,
      `Follow-up: ${issues.join('; ') || 'Confirm scope and conditions with the reviewer.'}`,
      '',
    ]),
    'OPEN ACTIONS (visible records only; workspace task sample may be limited):',
    ...review.tasks.map(
      (t) =>
        `${t.title} | Owner: ${t.assigned_user_id ?? 'Unassigned'} | Due: ${t.due_at ?? 'Not recorded'}`,
    ),
    '',
    review.latest
      ? `HUMAN DECISION: ${review.latest.decision} | ${review.staleDecision ? 'REVIEW AGAIN: context changed or unavailable' : 'Matches loaded review context; reconfirm before acting'}\nBy ${review.latest.decided_by} at ${review.latest.decided_at}\nReason: ${review.latest.reason}\nConditions: ${review.latest.conditions || 'None recorded'}`
      : 'HUMAN DECISION: not visible, not recorded, or workflow unavailable.',
  ].join('\n');
}
