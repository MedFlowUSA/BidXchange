import type { TenantData } from './tenant-types';

export function pursuitBrief(
  data: Pick<
    TenantData,
    | 'requirements'
    | 'evidenceReviews'
    | 'evidenceReviewsEnabled'
    | 'resolutions'
    | 'resolutionsEnabled'
  >,
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
    const resolution = data.resolutionsEnabled
      ? data.resolutions?.find((r) => r.requirement_id === requirement.id)
      : undefined;
    const reviewed = resolution?.review_current === true;
    const resolved =
      reviewed && ['supported', 'waived', 'not_applicable'].includes(resolution!.disposition);
    const blocked = reviewed
      ? resolution!.disposition === 'blocked'
      : requirement.status === 'blocked';
    if (blocked) issues.push('Blocked follow-up');
    if (reviewed && resolution!.disposition === 'awaiting_clarification')
      issues.push('Awaiting clarification');
    else if (!reviewed && requirement.status === 'missing_information')
      issues.push('Information needed');
    if (data.resolutionsEnabled && !resolution) issues.push('Requirement has not been reviewed');
    if (resolution && !reviewed) issues.push('Requirement review is no longer current');
    if (reviewed && resolution!.disposition === 'needs_review')
      issues.push('Requirement needs review');
    if (!requirement.citation?.trim()) issues.push('Notice citation missing');
    if (!requirement.owner_user_id) issues.push('Review owner missing');
    if (stale && !resolved) issues.push('Previous evidence approval needs review');
    if (data.evidenceReviewsEnabled && !approved && !resolved)
      issues.push('No current evidence approval visible');
    return { requirement, approved, stale, issues, resolution, resolved, blocked };
  });
  rows.sort(
    (a, b) =>
      Number(b.blocked) - Number(a.blocked) ||
      Number(a.resolved) - Number(b.resolved) ||
      b.stale - a.stale ||
      b.issues.length - a.issues.length ||
      a.requirement.id.localeCompare(b.requirement.id),
  );
  return {
    rows,
    partial:
      requirements.length > 500 || reviews.length >= 500 || (data.resolutions?.length ?? 0) > 500,
  };
}
