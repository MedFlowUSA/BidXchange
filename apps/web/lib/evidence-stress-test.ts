import type { TenantData } from './tenant-types';

type StressData = Pick<
  TenantData,
  'facts' | 'requirements' | 'evidenceReviews' | 'evidenceReviewsEnabled'
>;

// A scenario over the caller's authorized snapshot, never an eligibility calculation.
export function evidenceStressTest(data: StressData, pursuitId: string, excluded: string[] = []) {
  const requirements = (data.requirements ?? [])
    .filter((r) => r.pursuit_id === pursuitId)
    .slice(0, 500);
  const facts = new Map(data.facts.slice(0, 500).map((f) => [f.id, f]));
  const requirementIds = new Set(requirements.map((r) => r.id));
  const links = new Map<string, Set<string>>();
  let omitted = false;
  for (const review of data.evidenceReviewsEnabled
    ? (data.evidenceReviews ?? []).slice(0, 500)
    : []) {
    if (
      !requirementIds.has(review.requirement_id) ||
      review.approval_current !== true ||
      review.proposal_use !== 'approved'
    )
      continue;
    if (!facts.has(review.fact_id)) {
      omitted = true;
      continue;
    }
    const ids = links.get(review.requirement_id) ?? new Set<string>();
    ids.add(review.fact_id);
    links.set(review.requirement_id, ids);
  }
  const choices = [...facts.values()]
    .flatMap((fact) => {
      const linked = requirements.filter((r) => links.get(r.id)?.has(fact.id));
      return linked.length ? [{ id: fact.id, label: fact.label, count: linked.length }] : [];
    })
    .sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
    );
  const allowed = new Set(choices.map((c) => c.id));
  const selected = new Set(excluded.filter((id) => allowed.has(id)));
  const affected = requirements
    .flatMap((requirement) => {
      const ids = [...(links.get(requirement.id) ?? [])];
      const removed = ids.filter((id) => selected.has(id));
      if (!removed.length) return [];
      return [{ requirement, removed: removed.length, remaining: ids.length - removed.length }];
    })
    .sort((a, b) => a.remaining - b.remaining || a.requirement.id.localeCompare(b.requirement.id));
  return {
    choices,
    affected,
    selectedCount: selected.size,
    withoutAlternative: affected.filter((r) => r.remaining === 0).length,
    omitted,
    partial:
      (data.requirements?.length ?? 0) > 500 ||
      (data.evidenceReviews?.length ?? 0) >= 500 ||
      data.facts.length >= 500,
  };
}
