import { createRoot } from 'react-dom/client';
import CompanyPortal, { CompanyPanel } from '../../apps/web/components/company-portal';
import DecisionMemoryPanel from '../../apps/web/components/decision-memory';
import PursuitDecision from '../../apps/web/components/pursuit-decision';
import { qualificationData } from './qualification-data';
import '../../apps/web/app/globals.css';
const query = new URLSearchParams(location.search);
const data = qualificationData(query.get('role') ?? 'organization_admin');
data.decisionMemoryEnabled = true;
data.registerSignoffsEnabled = true;
data.decisionContext = 'a'.repeat(32);
data.decisionMemory = {
  entries: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      pursuit_id: data.pursuits[0].id,
      reason: 'Fictional bond capacity and meeting conflict.',
      reason_codes: ['bond', 'site_visit'],
      decided_at: '2026-09-10T12:00:00Z',
      decided_by: data.userId,
      opportunity_snapshot: { title: 'Fictional C-10 lighting notice', buyer: 'Example City' },
      review_snapshot: {
        requirements: [
          {
            id: 'r1',
            text: 'Fictional bid bond requirement',
            status: 'blocked',
            citation: 'Section 4',
          },
        ],
      },
      match_version: 'contractor-memory-v1',
      matched_features: ['agency:example city', 'requirement:bond'],
    },
  ],
  reviews: [],
  context: 'a'.repeat(32),
  opportunityId: query.has('match') ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : undefined,
};
createRoot(document.getElementById('root')!).render(
  <main style={{ padding: 18, maxWidth: 1100, margin: 'auto' }}>
    {query.has('match') ? (
      <DecisionMemoryPanel data={data} />
    ) : (
      <CompanyPortal data={data} reviewCount={0}>
        <CompanyPanel name="overview">
          <h2>Company overview</h2>
        </CompanyPanel>
        <CompanyPanel name="decisions">
          <DecisionMemoryPanel data={data} />
        </CompanyPanel>
      </CompanyPortal>
    )}
    <PursuitDecision data={data} pursuit={data.pursuits[0]} />
  </main>,
);
