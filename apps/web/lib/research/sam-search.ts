import type { SupabaseClient } from '@supabase/supabase-js';
import { AiError, type Role } from '../ai/contracts';
import { discloseFact, sourceFreshness } from '../ai/policy';
import { reviewStatus } from '../company-readiness';
import type { Fact } from '../tenant-types';
import { normalizeSam, samConnector } from '../sources/sam';
import type { ResearchPlan } from './contracts';
import {
  defaultSamFilters,
  validateSamFilters,
  type SamCompanyCode,
  type SamFilters,
  type SamReport,
} from './sam-contracts';

export function companySamCodes(facts: Fact[], role: Role, now: string): SamCompanyCode[] {
  const results: SamCompanyCode[] = [];
  for (const fact of facts) {
    if (
      !discloseFact(role, fact.sensitivity, fact.fact_type) ||
      !['reviewed', 'expiring'].includes(reviewStatus(fact, now)) ||
      sourceFreshness(
        { ...fact, last_checked: fact.structured_fields?.last_checked },
        new Date(now),
      ) !== 'current'
    )
      continue;
    const value =
      fact.structured_kind === 'procurement_codes'
        ? fact.structured_fields?.naics
        : fact.fact_type === 'naics'
          ? fact.value
          : null;
    for (const code of (value ?? '').split(/[^0-9]+/).filter((c) => /^\d{6}$/.test(c))) {
      if (!results.some((r) => r.code === code))
        results.push({ code, factId: fact.id, label: fact.label.slice(0, 200) });
      if (results.length === 10) return results;
    }
  }
  return results;
}
export async function readSamCompany(db: SupabaseClient, org: string, role: Role, now: string) {
  const facts = await db
    .from('profile_facts')
    .select(
      'id,fact_type,label,value,sensitivity,verification_status,source_reference,verified_by,verified_at,effective_date,expiration_date,updated_at,structured_kind,structured_fields',
    )
    .eq('organization_id', org)
    .in('fact_type', ['naics', 'capability'])
    .order('updated_at', { ascending: false })
    .order('id')
    .limit(101);
  if (facts.error) throw new AiError('service_unavailable', 503);
  return {
    codes: companySamCodes((facts.data ?? []).slice(0, 100) as Fact[], role, now),
    partial: (facts.data?.length ?? 0) > 100,
  };
}
export function prepareSamFilters(plan: ResearchPlan, now: Date) {
  const filters = defaultSamFilters(now);
  const warnings = [
    'AI-suggested filters: review and edit before searching. Title keywords search notice titles, not full attachments.',
  ];
  filters.title = plan.keywords[0]?.slice(0, 120) ?? '';
  filters.naics = /^\d{6}$/.test(plan.naics[0] ?? '') ? plan.naics[0] : '';
  filters.state = plan.states[0] ?? '';
  filters.postedFrom = plan.publishedFrom ?? filters.postedFrom;
  filters.postedTo = plan.publishedTo ?? filters.postedTo;
  if (plan.keywords.length > 1 || plan.naics.length > 1 || plan.states.length > 1)
    warnings.push(
      'This search accepts one title phrase, NAICS code and state at a time. Only the first suggested value is filled; run additional searches for other trades or areas.',
    );
  if (
    plan.agencies.length ||
    plan.psc.length ||
    plan.setAsides.length ||
    plan.noticeTypes.length ||
    plan.deadlineFrom ||
    plan.deadlineTo ||
    plan.radiusMiles ||
    !['discover'].includes(plan.intent) ||
    plan.status !== 'active'
  )
    warnings.push(
      'Agency, PSC, set-aside, distance, deadline, historical changes and award/profitability analysis are not applied by this search. Review the notice type selector and official source.',
    );
  return {
    filters,
    warnings,
    unsupported: plan.intent === 'grants' || plan.source === 'workspace',
  };
}
export async function searchSam(
  filters: SamFilters,
  key: string,
  codes: SamCompanyCode[],
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<SamReport> {
  validateSamFilters(filters);
  const connector = samConnector(
    { enabled: true, key, days: 31, limit: 10, pages: 1, timeout: 12000 },
    new Date(filters.postedFrom),
    new Date(filters.postedTo),
    request,
    {
      title: filters.title,
      ncode: filters.naics,
      state: filters.state,
      ptype: filters.noticeType,
    },
    1,
  );
  const page = await connector.page(0, signal);
  const ids = new Set<string>();
  const results: SamReport['results'] = [];
  for (const raw of page.records) {
    const n = normalizeSam(raw, key).notice;
    if (ids.has(n.noticeId)) continue;
    ids.add(n.noticeId);
    const place = n.place as { state?: { code?: unknown } } | null;
    results.push({
      id: n.noticeId,
      title: n.title,
      agency: [n.department, n.subtier, n.office].filter(Boolean).join(' / ') || null,
      solicitationNumber: n.solicitationNumber,
      url: n.sourceUrl,
      published: n.published,
      deadline: n.deadline,
      deadlineInstant: n.deadlineInstant,
      naics: n.naics,
      state: typeof place?.state?.code === 'string' ? place.state.code.slice(0, 10) : null,
      status: n.status,
      noticeType: n.noticeType,
      companyEvidence: codes.filter((c) => c.code === n.naics),
    });
  }
  return {
    filters,
    checkedAt: new Date().toISOString(),
    total: page.total,
    returned: results.length,
    partial: page.total > page.records.length,
    warnings: [
      'One page of up to 10 official API records; not a complete market search. Publication dates are distinct from the time checked.',
      'Confirm active status, deadline and time zone on the official notice. Attachments and full requirements were not fetched. Code overlap is not qualification; license, DIR, insurance, bonding and job walks need human review.',
    ],
    results,
    canSave: false,
    defaultTimezone: 'UTC',
  };
}
