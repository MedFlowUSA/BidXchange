import type { Fact, TenantData } from './tenant-types';
import { discloseFact, displayDate } from './ai/policy';

export function exportableFact(f: Fact, now: Date) {
  const day = now.toISOString().slice(0, 10);
  return Boolean(
    discloseFact('viewer', f.sensitivity, f.fact_type) &&
    f.value?.trim() &&
    f.source_reference?.trim() &&
    f.verification_status === 'verified' &&
    f.verified_by &&
    f.verified_at &&
    Number.isFinite(Date.parse(f.verified_at)) &&
    Date.parse(f.verified_at) <= now.getTime() &&
    (!f.expiration_date || f.expiration_date >= day) &&
    (!f.effective_date || f.effective_date <= day),
  );
}

export function responseAutofill(data: TenantData, pursuitId: string, now = new Date()) {
  const pursuit = data.pursuits.find((p) => p.id === pursuitId);
  const opportunity = data.opportunities.find((o) => o.id === pursuit?.opportunity_id);
  if (!pursuit || !opportunity) throw new Error('Pursuit source is unavailable.');
  if (data.facts.length >= 500)
    throw new Error('The company profile may be incomplete. Reduce its scope before exporting.');
  const basics = new Set(['identity', 'registration', 'naics', 'service_territory']);
  const requirementIds = new Set(
    (data.requirements ?? []).filter((r) => r.pursuit_id === pursuitId).map((r) => r.id),
  );
  const approvedIds = new Set(
    data.evidenceReviewsEnabled
      ? (data.evidenceReviews ?? [])
          .filter(
            (e) =>
              requirementIds.has(e.requirement_id) &&
              e.approval_current === true &&
              e.proposal_use === 'approved' &&
              e.applicability === 'applicable',
          )
          .map((e) => e.fact_id)
      : [],
  );
  const facts = data.facts
    .filter((f) => exportableFact(f, now) && (basics.has(f.fact_type) || approvedIds.has(f.id)))
    .sort(
      (a, b) =>
        a.fact_type.localeCompare(b.fact_type) ||
        a.label.localeCompare(b.label) ||
        a.id.localeCompare(b.id),
    );
  const company = [
    { label: 'Legal name', value: data.organization.legal_name || '[Not recorded]' },
    { label: 'Operating name', value: data.organization.operating_name || '[Not recorded]' },
    { label: 'Website', value: data.organization.website || '[Not recorded]' },
  ];
  const bid = [
    { label: 'Pursuit', value: pursuit.title },
    { label: 'Opportunity', value: opportunity.title || '[Not recorded]' },
    { label: 'Buyer', value: opportunity.buyer || '[Not recorded]' },
    { label: 'Solicitation number', value: opportunity.solicitation_number || '[Not recorded]' },
    { label: 'Scope / notice summary', value: opportunity.summary || '[Not recorded]' },
    {
      label: 'Submission deadline',
      value: opportunity.official_deadline
        ? displayDate(opportunity.official_deadline, opportunity.deadline_timezone)
        : '[Not recorded]',
    },
    { label: 'Deadline time zone', value: opportunity.deadline_timezone || '[Not recorded]' },
    { label: 'Notice URL', value: opportunity.source_url || '[Not recorded]' },
    { label: 'Source reference', value: opportunity.source_note || '[Not recorded]' },
  ];
  const gaps: string[] = [];
  for (const [name, pattern] of [
    ['Company address', /address/i],
    ['Business phone', /phone|telephone/i],
    ['Business email', /e-?mail/i],
    ['Company contact', /contact|representative/i],
  ] as const)
    if (!facts.some((f) => f.fact_type === 'identity' && pattern.test(f.label)))
      gaps.push(
        `${name}: no current verified workspace-visible record. Complete or verify it in Company.`,
      );
  for (const row of [...company, ...bid].filter((r) => r.value === '[Not recorded]'))
    gaps.push(`${row.label}: not recorded.`);
  if (
    data.facts.some(
      (f) => discloseFact('viewer', f.sensitivity, f.fact_type) && !exportableFact(f, now),
    )
  )
    gaps.push(
      'Some company records are unverified, incomplete, expired or not yet effective and were omitted. Review Company before using this draft.',
    );
  return { company, bid, facts, gaps };
}
