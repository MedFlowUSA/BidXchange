import { createRoot } from 'react-dom/client';
import CompanyPassport from '../../apps/web/components/company-passport';
import EvidenceRenewals from '../../apps/web/components/evidence-renewals';
import RegisterSignoff from '../../apps/web/components/register-signoff';
import PursuitDecision from '../../apps/web/components/pursuit-decision';
import OpportunityAmendments from '../../apps/web/components/opportunity-amendments';
import { qualificationData } from './qualification-data';
import '../../apps/web/app/globals.css';
const data = qualificationData();
data.structuredProfilesEnabled = true;
data.registerSignoffsEnabled = true;
data.contractorWorkflowEnabled = true;
data.registerSignoffs = [];
data.facts[0].expiration_date = '2026-09-01';
data.amendments = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    label: 'Fictional Addendum 1',
    source_url: 'https://example.test/addendum',
    summary: 'Fictional revised insurance requirement',
    issued_on: '2026-09-21',
    updated_at: '2026-09-21T00:00:00Z',
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
  },
];
createRoot(document.getElementById('root')!).render(
  <main>
    <p>Fictional test workspace. No company data are saved.</p>
    <CompanyPassport data={data} />
    <EvidenceRenewals data={data} />
    <RegisterSignoff data={data} pursuitId={data.pursuits[0].id} />
    <PursuitDecision data={data} pursuit={data.pursuits[0]} />
    <OpportunityAmendments data={data} pursuitId={data.pursuits[0].id} />
  </main>,
);
