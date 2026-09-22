import type { Fact } from '../tenant-types';
import { reviewStatus } from '../company-readiness';
import type { ResearchNotice, ResearchPlan, ResearchReport } from './contracts';

const areas: [string, string[]][] = [
  ['Services and products', ['capability']],
  ['Procurement codes', ['naics', 'psc', 'capability']],
  ['Licenses', ['license']],
  ['Certifications and set-asides', ['certification']],
  ['Service area', ['service_territory', 'territory']],
  ['Bonding', ['bonding']],
  ['Insurance', ['insurance']],
  ['Workforce and equipment', ['personnel', 'capacity']],
  ['Past performance', ['past_performance']],
  ['Financial and project-size capacity', ['financial']],
];
export function evaluateResearch(
  notices: ResearchNotice[],
  facts: Fact[],
  plan: ResearchPlan,
  now: string,
) {
  const verified = facts.filter((f) => ['reviewed', 'expiring'].includes(reviewStatus(f, now)));
  const missingCompany = areas
    .filter(([, types]) => !verified.some((f) => types.includes(f.fact_type)))
    .map(([label]) => label);
  missingCompany.push(
    'Preferred project size, prime/subcontractor strategy and exclusions require explicit review',
  );
  const results: ResearchReport['results'] = [];
  for (const notice of notices) {
    if (plan.intent === 'grants') continue;
    if (
      plan.source !== 'all' &&
      (plan.source === 'workspace' ? notice.source !== 'workspace' : notice.source !== plan.source)
    )
      continue;
    // No complete history of archived notices is implied by an inactive SAM record.
    if (plan.status === 'archived' && notice.status !== 'archived') continue;
    if (plan.status === 'active' && !['active', 'open', 'unknown'].includes(notice.status))
      continue;
    if (plan.intent === 'changes' && !notice.changedFields.length) continue;
    const unknownFilters: string[] = [];
    let exclude = false;
    const checks: [string, string[], string | null, boolean][] = [
      ['Title keywords', plan.keywords, notice.title, true],
      ['NAICS', plan.naics, notice.naics, false],
      ['PSC', plan.psc, notice.psc, false],
      ['Agency', plan.agencies, notice.agency, true],
      ['State', plan.states, notice.state, false],
      ['Set-aside', plan.setAsides, notice.setAside, false],
      ['Notice type', plan.noticeTypes, notice.noticeType, true],
    ];
    const matches: ResearchReport['results'][number]['matches'] = [];
    for (const [label, values, actual, substring] of checks) {
      if (!values.length) continue;
      if (!actual) {
        unknownFilters.push(label);
        continue;
      }
      const actualValues = actual.toLowerCase().split(/[\s,;]+/);
      if (
        !values.some((v) =>
          substring
            ? actual.toLowerCase().includes(v.toLowerCase())
            : actualValues.includes(v.toLowerCase()),
        )
      ) {
        exclude = true;
        break;
      }
      matches.push({ component: `Search filter: ${label}`, points: 1, evidenceIds: [] });
    }
    for (const [label, actual, from, to] of [
      ['Publication date', notice.published, plan.publishedFrom, plan.publishedTo],
      ['Response deadline', notice.deadline, plan.deadlineFrom, plan.deadlineTo],
    ] as const) {
      if (!from && !to) continue;
      const day = actual?.slice(0, 10);
      if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        unknownFilters.push(label);
        continue;
      }
      if ((from && day < from) || (to && day > to)) exclude = true;
    }
    if (exclude) continue;
    for (const [component, value, kind, field] of [
      ['Company NAICS overlap', notice.naics, 'naics', 'naics'],
      ['Company PSC overlap', notice.psc, 'psc', 'psc'],
    ] as const) {
      if (!value) continue;
      const evidence = verified.filter((f) => {
        const text =
          f.structured_kind === 'procurement_codes'
            ? f.structured_fields?.[field]
            : f.fact_type === kind
              ? f.value
              : null;
        return text
          ?.split(/[^a-zA-Z0-9]+/)
          .some((code) => code.toLowerCase() === value.toLowerCase());
      });
      if (evidence.length)
        matches.push({ component, points: 1, evidenceIds: evidence.map((f) => f.id) });
    }
    if (notice.status === 'unknown') unknownFilters.push('Active status');
    const passedDeadline =
      !!notice.deadline &&
      /(?:Z|[+-]\d{2}:\d{2})$/.test(notice.deadline) &&
      Date.parse(notice.deadline) < Date.parse(now);
    const qualification = [
      ...notice.blockers.map((b) => ({
        area: 'Recorded requirement blocker',
        status: 'Fail — recorded blocker',
        reason: b.requirement,
      })),
      ...areas.map(([area, types]) => ({
        area,
        status: verified.some((f) => types.includes(f.fact_type))
          ? 'Requires human review'
          : 'Unknown',
        reason: verified.some((f) => types.includes(f.fact_type))
          ? 'Verified company records are visible; solicitation-specific compatibility has not been determined.'
          : 'No current verified evidence is visible for this area.',
      })),
      {
        area: 'Submission time',
        status: passedDeadline
          ? 'Requires human review'
          : notice.deadline
            ? 'Requires human review'
            : 'Unknown',
        reason: passedDeadline
          ? 'Recorded deadline has passed. Confirm an official extension before proceeding.'
          : notice.deadline
            ? 'Confirm the source deadline, time zone and preparation time.'
            : 'No response deadline recorded.',
      },
      ...[
        'Mandatory eligibility',
        'Security clearance',
        'Proposal effort',
        'Prime or subcontractor suitability',
        'Strategic value and margin',
      ].map((area) => ({
        area,
        status: 'Unknown',
        reason: 'Full solicitation requirements and an authorized assessment are needed.',
      })),
    ];
    results.push({
      notice,
      matches,
      unknownFilters,
      qualification,
      nextAction: notice.blockers.length
        ? 'Resolve the recorded requirement blockers before advancing this opportunity.'
        : passedDeadline
          ? 'Confirm an official deadline extension before further pursuit work.'
          : 'Open the source and review all attachments; record mandatory requirements before making a bid decision.',
    });
  }
  // Transparent research relevance only. Unknown requested filters sort behind known matches.
  results.sort(
    (a, b) =>
      Number(a.notice.blockers.length > 0) - Number(b.notice.blockers.length > 0) ||
      a.unknownFilters.length - b.unknownFilters.length ||
      b.matches.filter((m) => m.evidenceIds.length).length -
        a.matches.filter((m) => m.evidenceIds.length).length ||
      b.matches.length - a.matches.length ||
      a.notice.id.localeCompare(b.notice.id),
  );
  return { results: results.slice(0, plan.limit), matched: results.length, missingCompany };
}
