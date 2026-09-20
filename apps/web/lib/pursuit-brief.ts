import type { TenantData } from './tenant-types';

export function pursuitBrief(
  data: Pick<TenantData, 'requirements' | 'evidenceReviews' | 'evidenceReviewsEnabled'>,
  pursuitId: string,
) {
  const requirements = (data.requirements ?? []).filter((r) => r.pursuit_id === pursuitId);
  const reviews = data.evidenceReviews ?? [];
  const rows = requirements.slice(0, 500).map((requirement) => {
    const linked = data.evidenceReviewsEnabled
      ? reviews.filter((r) => r.requirement_id === requirement.id)
      : [];
    const approved = linked.filter((r) => r.approval_current === true).length;
    const stale = linked.filter(
      (r) => r.proposal_use === 'approved' && r.approval_current !== true,
    ).length;
    const issues: string[] = [];
    if (requirement.status === 'blocked') issues.push('Blocked follow-up');
    if (requirement.status === 'missing_information') issues.push('Information needed');
    if (!requirement.citation?.trim()) issues.push('Notice citation missing');
    if (!requirement.owner_user_id) issues.push('Review owner missing');
    if (stale) issues.push('Previous evidence approval needs review');
    if (data.evidenceReviewsEnabled && !approved)
      issues.push('No current evidence approval visible');
    return { requirement, approved, stale, issues };
  });
  rows.sort(
    (a, b) =>
      Number(b.requirement.status === 'blocked') - Number(a.requirement.status === 'blocked') ||
      b.stale - a.stale ||
      b.issues.length - a.issues.length ||
      a.requirement.id.localeCompare(b.requirement.id),
  );
  return { rows, partial: requirements.length > 500 || reviews.length >= 500 };
}
