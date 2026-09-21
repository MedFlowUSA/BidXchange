import { createRoot } from 'react-dom/client';
import CompanyRecordForm from '../../apps/web/components/company-record-form';
import { workflowData } from './workflow-data';
import '../../apps/web/app/globals.css';
const data = workflowData();
createRoot(document.getElementById('root')!).render(
  <CompanyRecordForm
    structuredEnabled
    organizationId={data.organization.id}
    types={['identity']}
    members={data.members}
    userId={data.userId}
    suggestion={{
      type: 'identity',
      label: 'Business mailing address',
      prompt: 'Synthetic training only',
    }}
  />,
);
