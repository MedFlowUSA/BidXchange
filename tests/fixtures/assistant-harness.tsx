import { createRoot } from 'react-dom/client';
import Assistant from '../../apps/web/components/assistant';
import '../../apps/web/app/globals.css';
import { qualificationData } from './qualification-data';
import { pursuit } from './workflow-data';
const params = new URLSearchParams(location.search);
const data = qualificationData(params.has('viewer') ? 'viewer' : 'organization_admin');
data.contractorWorkflowEnabled = true;
createRoot(document.getElementById('root')!).render(
  <Assistant
    organizationId="11111111-1111-4111-8111-111111111111"
    name="Synthetic Test Company"
    expanded
    context={params.has('planning') ? { kind: 'pursuit', id: pursuit } : null}
    planningData={params.has('planning') ? data : undefined}
  />,
);
