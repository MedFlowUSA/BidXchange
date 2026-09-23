import { createRoot } from 'react-dom/client';
import QualificationWorkspace from '../../apps/web/components/qualification-workspace';
import ContractReadinessBrief from '../../apps/web/components/contract-readiness-brief';
import DeliveryReview from '../../apps/web/components/delivery-review';
import { qualificationData } from './qualification-data';
import { pursuit } from './workflow-data';
import '../../apps/web/app/globals.css';
const role =
  new URL(location.href).searchParams.get('role') === 'viewer' ? 'viewer' : 'organization_admin';
const data = qualificationData(role);
data.contractorWorkflowEnabled = true;
createRoot(document.getElementById('root')!).render(
  <>
    <ContractReadinessBrief data={qualificationData(role)} pursuitId={pursuit} />
    <DeliveryReview data={qualificationData(role)} pursuitId={pursuit} />
    <QualificationWorkspace data={data} pursuitId={pursuit} />
  </>,
);
