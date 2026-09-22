import { daysUntilExpiration } from './company-readiness';
import type { Fact } from './tenant-types';

export const californiaPassportSteps = [
  {
    id: 'identity',
    question: 'Who is bidding?',
    why: 'Start with the legal entity, DBA and headquarters city/state.',
    items: [
      {
        type: 'identity',
        label: 'Legal business name',
        prompt:
          'Enter legal name, DBA, entity type, headquarters city and state. Leave advanced details blank.',
      },
    ],
  },
  {
    id: 'registrations',
    question: 'Which registrations are claimed?',
    why: 'SAM and DIR are separate registrations. Record the source and the date checked; neither determines eligibility.',
    items: [
      {
        type: 'registration',
        label: 'SAM registration and UEI',
        prompt:
          'Record UEI, SAM status as claimed, last-checked date and the renewal date if known.',
      },
      {
        type: 'registration',
        label: 'DIR public-works registration',
        prompt:
          'Use DIR PWCR as the program. Record number, claimed status, last checked and expiration if applicable.',
      },
    ],
  },
  {
    id: 'licenses',
    question: 'Which California license is held?',
    why: 'A person must compare classifications with the actual scope.',
    items: [
      {
        type: 'license',
        label: 'CSLB license and classifications',
        prompt:
          'Record the primary CSLB number, classifications and expiration. Cite the official record checked.',
      },
    ],
  },
  {
    id: 'territory',
    question: 'Where and what work do you perform?',
    why: 'Help reviewers compare the location and scope with your actual services.',
    items: [
      {
        type: 'service_territory',
        label: 'Service area and travel limits',
        prompt:
          'List counties served and/or a radius from a named city, such as Redlands, California. Describe field services.',
      },
      {
        type: 'capability',
        label: 'Procurement classification codes',
        prompt:
          'Enter a short list of NAICS codes and a plain-language service description. Other code fields are optional.',
      },
    ],
  },
  {
    id: 'coverage',
    question: 'What bonding and insurance information is available?',
    why: 'Use claimed bonding bands; no upload or precise financial estimate is needed.',
    items: [
      {
        type: 'bonding',
        label: 'Bonding bands and bid-bond capability',
        prompt:
          'Use ranges such as under $250k, $250k–$1m, $1m–$5m, over $5m, or unknown. Enter single-project and aggregate bands and claimed bid-bond capability.',
      },
      {
        type: 'insurance',
        label: 'General liability insurance',
        prompt:
          'Record policy type and expiration. Leave policy numbers and detailed limits for later.',
      },
      {
        type: 'insurance',
        label: 'Workers’ compensation insurance',
        prompt: 'Record workers’ compensation policy type and expiration.',
      },
      {
        type: 'insurance',
        label: 'Commercial auto insurance',
        prompt: 'Record commercial auto policy type and expiration.',
      },
    ],
  },
  {
    id: 'experience',
    question: 'Which three projects can you describe?',
    why: 'Do not disclose a customer or reuse project text without permission.',
    items: [1, 2, 3].map((n) => ({
      type: 'past_performance',
      label: `Past project ${n}`,
      prompt:
        'Record customer, prime/subcontractor role, value band, year, one-line scope, location and permission to disclose. Unknown answers can be completed later.',
    })),
  },
];

export function freshnessRadar(facts: Fact[], asOf: string) {
  return facts.map((fact) => {
    const days = daysUntilExpiration(fact.expiration_date, asOf);
    const checked = fact.structured_fields?.last_checked || fact.verified_at?.slice(0, 10) || null;
    const checkedDays = checked ? daysUntilExpiration(checked, asOf) : null;
    return {
      fact,
      days,
      checked,
      stale: checkedDays !== null && checkedDays < -90,
      missingChecked: checkedDays === null,
      missingExpiration:
        !fact.expiration_date &&
        ['license', 'registration', 'insurance', 'certification'].includes(fact.fact_type) &&
        !/^(uei|cage|uei and cage identifiers)$/i.test(fact.label.trim()),
      window:
        days === null
          ? null
          : days < 0
            ? 'expired'
            : days <= 30
              ? '30'
              : days <= 60
                ? '60'
                : days <= 90
                  ? '90'
                  : null,
    };
  });
}
