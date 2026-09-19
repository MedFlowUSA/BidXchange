import type { Gate, Factor } from '../../../packages/scoring';
export type Stage = 'Inbox' | 'In review' | 'Pursuing' | 'Passed';
export type Opportunity = {
  id: string;
  title: string;
  buyer: string;
  category: string;
  location: string;
  source: string;
  deadline: string;
  timezone: string;
  value: number | null;
  summary: string;
  stage: Stage;
  gates: Gate[];
  factors: Factor[];
  tasks: { title: string; done: boolean }[];
};
const gates: Gate[] = [
  {
    name: 'Required license',
    status: 'pass',
    evidence: 'Fictional company profile · General Building B',
  },
  {
    name: 'Bonding capacity',
    status: 'pass',
    evidence: 'Fictional company profile · $2M single-project capacity',
  },
  {
    name: 'Mandatory events',
    status: 'pass',
    evidence: 'Sample solicitation §3 · No mandatory event',
  },
  {
    name: 'Registration',
    status: 'pass',
    evidence: 'Sample supplier registration · Active through December 2026',
  },
];
const factors = (score: number): Factor[] => [
  { name: 'Scope & experience', score, weight: 35 },
  { name: 'Geography', score: 100, weight: 20 },
  { name: 'Delivery capacity', score: score - 5, weight: 25 },
  { name: 'Response readiness', score: score - 10, weight: 20 },
];
export const seedOpportunities: Opportunity[] = [
  {
    id: 'DEMO-001',
    title: 'Municipal building energy retrofit',
    buyer: 'Canyon Springs · Public Works',
    category: 'Energy efficiency',
    location: 'Riverside County, CA',
    source: 'Manual entry',
    deadline: '2026-10-08T21:00:00Z',
    timezone: 'America/Los_Angeles',
    value: 850000,
    summary:
      'Upgrade lighting, building controls, and insulation across three municipal facilities. Includes an energy baseline, installation plan, and post-installation measurement. This is a fictional solicitation for workflow testing.',
    stage: 'Inbox',
    gates,
    factors: factors(96),
    tasks: [
      { title: 'Review scope and eligibility', done: true },
      { title: 'Confirm estimating capacity', done: false },
      { title: 'Prepare bid/no-bid recommendation', done: false },
    ],
  },
  {
    id: 'DEMO-002',
    title: 'Community aquatic center rehabilitation',
    buyer: 'Arroyo Vista · Parks & Recreation',
    category: 'Pool rehabilitation',
    location: 'Orange County, CA',
    source: 'Manual entry',
    deadline: '2026-10-15T22:00:00Z',
    timezone: 'America/Los_Angeles',
    value: 620000,
    summary:
      'Rehabilitate a community pool, replace circulation equipment, and improve accessible entry. Fictional opportunity; confirm specialty license and site conditions before a real pursuit.',
    stage: 'Pursuing',
    gates,
    factors: factors(89),
    tasks: [
      { title: 'Review scope and eligibility', done: true },
      { title: 'Prepare cost estimate', done: false },
      { title: 'Collect project references', done: false },
    ],
  },
  {
    id: 'DEMO-003',
    title: 'School district weatherization program',
    buyer: 'Mesa Grove · Unified School District',
    category: 'Building upgrades',
    location: 'San Bernardino County, CA',
    source: 'Manual entry',
    deadline: '2026-10-21T21:00:00Z',
    timezone: 'America/Los_Angeles',
    value: 1200000,
    summary:
      'Envelope repairs and weatherization for six school buildings, with phased work during school breaks. Fictional procurement for demonstrating qualification.',
    stage: 'In review',
    gates: gates.map((g, i) =>
      i === 1
        ? {
            ...g,
            status: 'unknown',
            evidence: 'Aggregate bonding availability has not been confirmed.',
          }
        : g,
    ),
    factors: factors(80),
    tasks: [
      { title: 'Confirm aggregate bonding availability', done: false },
      { title: 'Review school-break work schedule', done: false },
    ],
  },
  {
    id: 'DEMO-004',
    title: 'Fleet depot EV charging installation',
    buyer: 'Westhaven · Transit Authority',
    category: 'Electrification',
    location: 'Los Angeles County, CA',
    source: 'Manual entry',
    deadline: '2026-10-28T20:00:00Z',
    timezone: 'America/Los_Angeles',
    value: 480000,
    summary:
      'Design and install fleet charging infrastructure. This fictional notice requires electrical licensing that the demo company does not hold.',
    stage: 'Inbox',
    gates: gates.map((g, i) =>
      i === 0
        ? {
            ...g,
            status: 'fail',
            evidence:
              'Sample solicitation §2.1 requires C-10. No verified C-10 license or approved partner on file.',
          }
        : g,
    ),
    factors: factors(85),
    tasks: [{ title: 'Resolve electrical licensing gap', done: false }],
  },
  {
    id: 'DEMO-005',
    title: 'Civic center facilities improvements',
    buyer: 'Sunridge · Facilities Department',
    category: 'Building upgrades',
    location: 'San Diego County, CA',
    source: 'Manual entry',
    deadline: '2026-11-05T22:00:00Z',
    timezone: 'America/Los_Angeles',
    value: 350000,
    summary:
      'Interior renovations and efficiency upgrades to a civic administration building. Fictional record used to test the contract desk.',
    stage: 'Inbox',
    gates,
    factors: factors(73),
    tasks: [{ title: 'Review scope and eligibility', done: false }],
  },
];
export const sampleDocuments = [
  {
    name: 'Company capability statement',
    category: 'Company',
    status: 'Sample',
    text: 'FICTIONAL DEMO DOCUMENT\nApex Energy Demo\nCapabilities: building upgrades, energy efficiency, pool rehabilitation.\nTerritory: Southern California.\nThis is not verified company evidence.',
  },
  {
    name: 'Energy retrofit · scope summary',
    category: 'Solicitation',
    status: 'Sample',
    text: 'FICTIONAL SOLICITATION — DEMO-001\nScope: lighting, controls, insulation for three municipal facilities.\nRequired license: B.\nNo mandatory site meeting.\nDue: October 8, 2026, 2:00 PM America/Los_Angeles.\nFor interface testing only.',
  },
  {
    name: 'Bid readiness checklist',
    category: 'Template',
    status: 'Template',
    text: 'BID READINESS CHECKLIST\n[ ] Verify licenses and registrations\n[ ] Confirm scope and capacity\n[ ] Review every addendum\n[ ] Confirm deadline and source timezone\n[ ] Assign compliance requirements\n[ ] Obtain named client approval\nFinal submission remains with the authorized contractor.',
  },
];
