import type { Fact, TenantData } from './tenant-types';
import type { Role } from './ai/contracts';
import { discloseFact, effectiveStatus } from './ai/policy';
import { qualificationMap } from './qualification-map';

export const resourceRulesVersion = 'contractor-resource-review-v1';
const rules = [
  {
    key: 'license',
    need: /\blicen[sc]|\bcslb\b|\btrade\b|\bpermit/,
    fact: /licen[sc]|\bcslb\b|classification/,
    types: ['license'],
    approach:
      'Map the work items to the documented license scope and jurisdiction. Name the delivery party for each trade; use a permitted, qualified partner only after reviewing its credentials and commitment.',
  },
  {
    key: 'insurance',
    need: /insur|coverage|endorsement|professional.*cyber/,
    fact: /insur|compensation|liability|auto|cyber|crime/,
    types: ['insurance'],
    approach:
      'Have the broker compare the required limits, endorsements, insured entities and service territory with current policies. Obtain missing coverage and a renewal plan before making a commitment.',
  },
  {
    key: 'bond',
    need: /\bbond/,
    fact: /bond/,
    types: ['bonding', 'bond', 'compliance'],
    approach:
      'Ask the surety for project-specific availability and required bond forms. A contractor license bond does not establish bid, payment or performance bonding capacity.',
  },
  {
    key: 'registration',
    need: /\bsam\b|\buei\b|debar|business authority|registration|registered|\bdir\b/,
    fact: /\bsam\b|\buei\b|\bcage\b|\bdir\b|corporation|registration/,
    types: ['registration', 'federal'],
    approach:
      'Confirm the exact entity, registration program, jurisdiction and current status requested by the buyer. Supply the applicable record; a different registration or an identifier alone is insufficient.',
  },
  {
    key: 'experience',
    need: /experience|reference|past performance/,
    fact: /experience|project|performance|recognition|installation|service volume/,
    types: ['experience', 'past_performance'],
    approach:
      'Select comparable completed projects with dates, scope, the company’s role and permission to disclose. Explain how that experience supports this work; replace aggregate marketing totals with the project evidence the buyer asks for.',
  },
  {
    key: 'people',
    need: /crew|staff|personnel|delivery team|specialty partner|local.*team/,
    fact: /crew|staff|personnel|supervisor|manager|representative|partner|subcontractor/,
    types: ['personnel', 'key_personnel', 'approved_subcontractor', 'subcontractor'],
    approach:
      'Name the responsible delivery lead and confirm personnel or partner availability, qualifications, location and assigned scope. A team-page listing is not a staffing commitment.',
  },
  {
    key: 'customer',
    need: /tenant|enrollment|customer education|eligibility and coordination/,
    fact: /enrollment|intake|customer|education|assessment/,
    types: ['capability'],
    approach:
      'Describe how the documented customer-service experience would support this buyer’s intake and coordination process. Confirm program rules, staffing, consent and delivery responsibilities before promising service.',
  },
  {
    key: 'technical',
    need: /testing|combustion|ashrae|lead.safe|tier [12]|installation|weatherization|diagnostic/,
    fact: /testing|combustion|ashrae|lead.safe|installation|weatherization|appliance|assessment/,
    types: ['capability', 'certification'],
    approach:
      'Break the required work into measures and identify the qualified person or partner, equipment, delivery method and quality check for each. Confirm specialist credentials; a general service claim does not establish every technical capability.',
  },
  {
    key: 'territory',
    need: /territory|service area|local presence|geograph|location/,
    fact: /territory|county|california|pennsylvania|fresno|philadelphia/,
    types: ['territory', 'service_territory'],
    approach:
      'Confirm actual coverage at the job location, travel and dispatch arrangements, and any local authorization. A nearby or previously served market does not establish delivery capacity here.',
  },
] as const;

function planningStep(text: string, matched: (typeof rules)[number][]) {
  if (
    /\b(?:pric\w*|rates?|cash flow|costs?|budget\w*)\b|\bpayment\s+(?:terms|schedule|assumptions)\b/i.test(
      text,
    )
  )
    return 'Have the estimator and finance lead build this job’s quantities, labor, materials, partner quotes and payment assumptions. Enter human-approved prices; no price or margin is inferred from the profile.';
  if (/\b(?:deadline|submission|addend\w*|portal)\b/i.test(text))
    return 'Confirm the official instructions and latest amendments, name the responsible reviewer or submitter, and work backward from the recorded deadline. Record submission only after a person completes it externally.';
  if (/ai disclosure|data handling/i.test(text))
    return 'Describe the tools and data practices actually used, including human review. Have the responsible company officer approve the disclosure against the buyer’s exact questions.';
  return (
    matched[0]?.approach ??
    'Use the saved response as a working proposal. Identify who will perform the work, what resources are committed and what supporting evidence the buyer requests; have the requirement owner confirm the plan.'
  );
}

// Read-only coverage of a tenant-authorized snapshot. Suggestions never establish support.
export function bidAlignment(
  data: TenantData,
  pursuitId: string,
  restricted = false,
  now = new Date(),
) {
  const permitted = data.facts.filter((f) =>
    discloseFact(
      (restricted ? data.organization.role : 'viewer') as Role,
      f.sensitivity,
      f.fact_type,
    ),
  );
  const scoped = { ...data, facts: permitted, reviewAsOf: now.toISOString() };
  const map = qualificationMap(scoped, pursuitId);
  const rows = map.rows.map((row) => {
    const text = row.requirement.requirement;
    const matched = rules.filter((rule) => rule.need.test(text.toLowerCase()));
    const linked = row.evidence.map((e) => ({
      ...e,
      status: effectiveStatus(
        { ...e.fact, last_checked: e.fact.structured_fields?.last_checked },
        now,
      ),
    }));
    const resolution = row.resolution;
    const reviewed = !!(
      resolution?.review_current &&
      resolution.reviewed_by &&
      resolution.reviewed_at &&
      resolution.reason.trim()
    );
    const excluded =
      reviewed &&
      (resolution!.disposition === 'not_applicable' ||
        (resolution!.disposition === 'waived' &&
          !!resolution!.authority_name.trim() &&
          !!resolution!.authority_reference.trim()));
    const supported =
      !row.blocked &&
      reviewed &&
      resolution!.disposition === 'supported' &&
      linked.some(
        (e) =>
          e.approved &&
          ['human_attested', 'expiring'].includes(e.status) &&
          !e.needsRenewal &&
          (!['license', 'insurance', 'certification'].includes(e.fact.fact_type) ||
            !!e.fact.expiration_date),
      );
    const suggested = permitted
      .filter((f) => !linked.some((e) => e.fact.id === f.id))
      .flatMap((fact) => {
        const factText = `${fact.label} ${fact.value ?? ''}`.toLowerCase();
        const rule = matched.find(
          (r) =>
            (r.types as readonly string[]).includes(fact.fact_type) &&
            r.fact.test(factText) &&
            (r.key !== 'registration' ||
              (!/usdot|fmcsa/.test(factText) &&
                (!/\bsam\b|\buei\b|debar/i.test(text) ||
                  /\bsam\b|\buei\b|\bcage\b/.test(factText)) &&
                (!/\bdir\b/i.test(text) || /\bdir\b/.test(factText)))),
        );
        return rule
          ? [
              {
                fact,
                reason: `Shares the ${rule.key} topic with this requirement; scope, amounts, jurisdiction and availability have not been matched.`,
                status: effectiveStatus(
                  { ...fact, last_checked: fact.structured_fields?.last_checked },
                  now,
                ),
              },
            ]
          : [];
      })
      .sort(
        (a, b) => a.fact.label.localeCompare(b.fact.label) || a.fact.id.localeCompare(b.fact.id),
      )
      .slice(0, 3);
    const status = excluded
      ? 'Excluded by current human finding'
      : row.blocked
        ? 'Recorded blocker'
        : supported
          ? 'Supported by reviewed company resources'
          : linked.length
            ? 'Linked resources need review'
            : 'No reviewed resource match';
    const tasks = data.tasks.filter(
      (t) =>
        t.pursuit_id === pursuitId &&
        t.requirement_id === row.requirement.id &&
        !['complete', 'completed', 'cancelled'].includes(t.status),
    );
    return {
      ...row,
      linked,
      suggested,
      supported,
      excluded,
      status,
      tasks,
      approach: planningStep(text, matched),
    };
  });
  const excluded = rows.filter((r) => r.excluded).length;
  const applicable = rows.length - excluded,
    supported = rows.filter((r) => r.supported).length;
  const unavailable =
    !map.opportunity ||
    !data.requirements ||
    map.unavailable ||
    map.partial ||
    map.hiddenEvidence ||
    !map.deadlineDay ||
    map.deadlinePassed ||
    data.facts.length >= 500;
  const reason = !data.requirements
    ? 'Open the pursuit to load its requirements.'
    : !map.opportunity
      ? 'The bid record is unavailable.'
      : map.partial || data.facts.length >= 500
        ? 'The source set is partial.'
        : map.unavailable
          ? 'Requirement or evidence reviews are unavailable.'
          : map.hiddenEvidence
            ? 'Some linked evidence is outside this report’s disclosure level.'
            : !map.deadlineDay
              ? 'A valid submission deadline and time zone are needed.'
              : map.deadlinePassed
                ? 'The recorded deadline has passed; confirm an official extension.'
                : applicable === 0
                  ? 'No applicable requirements remain in the loaded register.'
                  : '';
  return {
    rows,
    applicable,
    supported,
    excluded,
    blocked: map.blocked,
    percent: !unavailable && applicable > 0 ? Math.floor((100 * supported) / applicable) : null,
    potential: rows.filter((r) => !r.excluded && !r.supported && r.suggested.length).length,
    reason,
    formula:
      'Current human-supported requirements with at least one current, approved, applicable company resource and no recorded expiration on or before the submission date ÷ active requirements excluding current documented waivers and not-applicable findings. License, insurance and certification records need an expiration date. Each requirement counts once; the percentage is rounded down.',
    notice:
      'This is reviewed evidence coverage, not legal eligibility, a win prediction or submission approval. Unknown and unreviewed requirements stay in the denominator. Suggested resources never count. A blocker remains important at any percentage. Coverage after submission requires separate review.',
  };
}

export function resourceLine(fact: Fact, status: string) {
  return `${fact.label}: ${fact.value ?? 'Value not recorded'}\nEvidence status: ${status.replaceAll('_', ' ')}; expires: ${fact.expiration_date ?? 'not recorded'}. Record ${fact.id}.`;
}
