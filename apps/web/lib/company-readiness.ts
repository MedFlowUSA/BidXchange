import type { Fact } from './tenant-types';

export const readinessAreas = [
  {
    id: 'identity',
    title: 'Company basics',
    types: ['identity'],
    why: 'Confirm the entity and representative named in a response.',
  },
  {
    id: 'capabilities',
    title: 'Work performed',
    types: ['capability', 'naics', 'psc'],
    why: 'Describe the work your company can support with evidence.',
  },
  {
    id: 'territory',
    title: 'Geographic coverage',
    types: ['territory', 'service_territory'],
    why: 'Confirm where the company can deliver the work.',
  },
  {
    id: 'registrations',
    title: 'Registrations and certifications',
    types: ['federal', 'registration', 'certification'],
    why: 'Review current identifiers, status and renewal dates for the relevant buyer.',
  },
  {
    id: 'licenses',
    title: 'Licenses',
    types: ['license'],
    why: 'Review the required classification, jurisdiction and current evidence.',
  },
  {
    id: 'coverage',
    title: 'Insurance and bonding',
    types: ['insurance', 'bonding'],
    why: 'An authorized reviewer must compare current coverage and capacity with each solicitation.',
  },
  {
    id: 'capacity',
    title: 'Delivery and financial capacity',
    types: ['capacity', 'financial'],
    why: 'Confirm availability, backlog and a comfortable project size.',
  },
  {
    id: 'experience',
    title: 'Past performance',
    types: ['past_performance', 'experience'],
    why: 'Prepare relevant project evidence and permission to use references.',
  },
  {
    id: 'people',
    title: 'Key personnel',
    types: ['personnel', 'key_personnel'],
    why: 'Confirm relevant qualifications, availability and proposal-use permission.',
  },
  {
    id: 'compliance',
    title: 'Safety and compliance',
    types: ['safety', 'compliance'],
    why: 'Have an authorized reviewer identify the evidence applicable to the work.',
  },
  {
    id: 'assets',
    title: 'Proposal assets',
    types: ['proposal_asset'],
    why: 'Identify approved narratives, project sheets and supporting evidence.',
  },
] as const;

export function reviewStatus(fact: Fact, asOf: string) {
  const today = asOf.slice(0, 10);
  if (fact.expiration_date && fact.expiration_date < today) return 'expired';
  if (fact.effective_date && fact.effective_date > today) return 'not_yet_effective';
  if (['expired', 'rejected'].includes(fact.verification_status)) return fact.verification_status;
  if (
    !fact.value?.trim() ||
    !fact.source_reference?.trim() ||
    !fact.verified_by ||
    !fact.verified_at
  )
    return 'needs_review';
  if (fact.verification_status === 'expiring') return 'expiring';
  return fact.verification_status === 'verified' ? 'reviewed' : 'needs_review';
}

export function companyReadiness(facts: Fact[], asOf: string) {
  const priority: Record<string, number> = {
    expired: 0,
    rejected: 1,
    not_yet_effective: 2,
    needs_review: 3,
    expiring: 4,
    reviewed: 5,
  };
  const needingReview = facts
    .filter((f) => reviewStatus(f, asOf) !== 'reviewed')
    .sort(
      (a, b) =>
        priority[reviewStatus(a, asOf)] - priority[reviewStatus(b, asOf)] ||
        a.label.localeCompare(b.label),
    );
  const groups = readinessAreas.map((area) => ({
    ...area,
    facts: facts.filter((f) => (area.types as readonly string[]).includes(f.fact_type)),
  }));
  const knownTypes = new Set<string>(readinessAreas.flatMap((a) => [...a.types]));
  return { needingReview, groups, other: facts.filter((f) => !knownTypes.has(f.fact_type)) };
}
