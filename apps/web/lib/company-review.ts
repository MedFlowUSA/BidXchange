import { companyReadiness, reviewStatus } from './company-readiness';
import { profileCompletion } from './profile-completion';
import type { Fact } from './tenant-types';

export function companyReview(facts: Fact[], asOf: string) {
  const core = new Set(['license', 'registration', 'federal', 'insurance', 'bonding']);
  const queue = companyReadiness(facts, asOf)
    .needingReview.map((fact, index) => {
      const status = reviewStatus(fact, asOf);
      const reasons: string[] = [];
      if (status === 'expired') reasons.push('Expired: obtain a current record.');
      if (status === 'rejected')
        reasons.push('Previously rejected: correct the record or its evidence.');
      if (status === 'not_yet_effective') reasons.push('Not yet effective: check the start date.');
      if (status === 'expiring')
        reasons.push('Expiring: arrange renewal and confirm the relevant bid dates.');
      if (!fact.value?.trim()) reasons.push('Add the company information.');
      if (!fact.source_reference?.trim()) reasons.push('Add a supporting source reference.');
      if (
        !fact.verified_by ||
        !fact.verified_at ||
        fact.verification_status === 'pending_verification'
      )
        reasons.push('A person must check the source and attest this record.');
      if (!reasons.length) reasons.push('Recheck the source date and current evidence status.');
      return { fact, status, reasons, index };
    })
    .sort((a, b) => {
      // Expiration/rejection takes precedence, then contractor evidence before marketing claims.
      const priority = (item: typeof a) =>
        ['expired', 'rejected'].includes(item.status) ? 0 : core.has(item.fact.fact_type) ? 1 : 2;
      return priority(a) - priority(b) || a.index - b.index;
    });
  const missing = profileCompletion(facts, asOf).sections.flatMap((section) =>
    section.items
      .filter((item) => item.completed < item.total)
      .map((item) => ({
        label: item.label,
        section: section.id,
        factId: item.factId,
        fields: item.checks.filter((check) => !check.recorded).map((check) => check.label),
      })),
  );
  return { queue, missing };
}
