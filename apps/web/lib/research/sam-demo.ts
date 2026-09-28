import { defaultSamFilters, type SamReport } from './sam-contracts';
// Curated product rehearsal, never passed to the live search endpoint or saved as a real opportunity.
export function samDemoReport(): SamReport {
  return {
    filters: { ...defaultSamFilters(), title: 'energy retrofit', state: 'CA', naics: '238210' },
    checkedAt: 'Fictional example; no source request',
    total: 1,
    returned: 1,
    partial: false,
    canSave: false,
    defaultTimezone: 'UTC',
    warnings: [
      'Scripted demonstration using Apex Energy Demo. This is not a SAM.gov notice or a live search. Changing the sample filters does not search for real bids.',
    ],
    results: [
      {
        id: 'DEMO-001',
        title: 'Municipal building energy retrofit',
        agency: 'Fictional municipal buyer',
        solicitationNumber: 'FICTIONAL-DEMO',
        url: null,
        published: null,
        deadline: null,
        deadlineInstant: null,
        naics: '238210',
        state: 'CA',
        status: 'Fictional example',
        noticeType: 'Illustrative solicitation',
        companyEvidence: [
          { code: '238210', factId: 'demo', label: 'Illustrative Apex trade code' },
        ],
      },
    ],
  };
}
