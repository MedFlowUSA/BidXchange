import type { Fact, TenantData } from './tenant-types';
import { discloseFact, displayDate } from './ai/policy';
import { companyTemplates, structuredErrors } from './company-fields';
import { freshnessRadar } from './california-passport';

export function exportableFact(f: Fact, now: Date) {
  const day = now.toISOString().slice(0, 10);
  return Boolean(
    discloseFact('viewer', f.sensitivity, f.fact_type) &&
    f.value?.trim() &&
    f.source_reference?.trim() &&
    f.verification_status === 'verified' &&
    f.verified_by &&
    f.verified_at &&
    !freshnessRadar([f], now.toISOString())[0].stale &&
    (f.fact_type !== 'past_performance' || f.structured_fields?.permission === 'yes') &&
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
  let facts = data.facts
    .filter((f) => exportableFact(f, now) && (basics.has(f.fact_type) || approvedIds.has(f.id)))
    .sort(
      (a, b) =>
        a.fact_type.localeCompare(b.fact_type) ||
        a.label.localeCompare(b.label) ||
        a.id.localeCompare(b.id),
    );
  const entities = facts.filter(
    (f) =>
      f.structured_kind === 'entity' &&
      f.fact_type === 'identity' &&
      structuredErrors('entity', f.structured_fields).length === 0 &&
      f.structured_fields?.legal_name === data.organization.legal_name,
  );
  const entity = entities.length === 1 ? entities[0].structured_fields : undefined;
  const company = [
    {
      label: 'Legal name',
      value: entity?.legal_name || '[HUMAN INPUT REQUIRED: attested legal name]',
    },
    {
      label: 'Operating name',
      value: entity?.operating_name || '[HUMAN INPUT REQUIRED: attested DBA]',
    },
    { label: 'Website', value: '[HUMAN INPUT REQUIRED: company website]' },
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
  if (data.structuredProfilesEnabled) {
    const rejected = new Set<string>();
    for (const fact of facts) {
      if (
        fact.structured_kind &&
        (companyTemplates[fact.structured_kind]?.type !== fact.fact_type ||
          structuredErrors(fact.structured_kind, fact.structured_fields).length)
      ) {
        rejected.add(fact.id);
        gaps.push('A structured company record is invalid and was omitted. Review Company.');
      }
      if (fact.fact_type === 'identity' && !fact.structured_kind) rejected.add(fact.id);
      if (
        fact.structured_kind === 'entity' &&
        fact.structured_fields?.legal_name &&
        fact.structured_fields.legal_name !== data.organization.legal_name
      ) {
        rejected.add(fact.id);
        gaps.push(
          'Structured legal name conflicts with the workspace legal name. Reconcile Company before use.',
        );
      }
    }
    const required: Record<string, string[]> = {
      mailing_address: ['line1', 'city', 'country'],
      business_phone: ['number'],
      business_email: ['email'],
      representative: ['name', 'title', 'authority'],
    };
    for (const [kind, template] of Object.entries(companyTemplates).filter(([, t]) => t.autofill)) {
      const candidates = facts.filter((f) => f.structured_kind === kind && !rejected.has(f.id));
      if (
        candidates.length !== 1 ||
        required[kind].some((key) => !candidates[0]?.structured_fields?.[key])
      ) {
        candidates.forEach((f) => rejected.add(f.id));
        gaps.push(
          `${template.autofill}: ${candidates.length > 1 ? 'multiple current records; select and reconcile the intended record' : 'no complete current human-attested structured record'}. Review Company before use.`,
        );
      }
    }
    if (facts.some((f) => f.fact_type === 'identity' && !f.structured_kind))
      gaps.push(
        'Legacy identity text has not been mapped to structured document fields and was omitted. Convert and reverify the intended records in Company.',
      );
    facts = facts.filter((f) => !rejected.has(f.id));
  } else
    for (const [name, pattern] of [
      ['Company address', /address/i],
      ['Business phone', /phone|telephone/i],
      ['Business email', /e-?mail/i],
      ['Company contact', /contact|representative/i],
    ] as const)
      if (!facts.some((f) => f.fact_type === 'identity' && pattern.test(f.label)))
        gaps.push(
          `${name}: no current human-attested workspace-visible record. Complete or attest it in Company.`,
        );
  for (const row of [...company, ...bid].filter(
    (r) => r.value === '[Not recorded]' || r.value.startsWith('[HUMAN INPUT REQUIRED'),
  ))
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
