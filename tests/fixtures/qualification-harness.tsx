import { createRoot } from 'react-dom/client';
import QualificationWorkspace from '../../apps/web/components/qualification-workspace';
import ContractReadinessBrief from '../../apps/web/components/contract-readiness-brief';
import { qualificationData } from './qualification-data';
import { pursuit } from './workflow-data';
import '../../apps/web/app/globals.css';
const role =
  new URL(location.href).searchParams.get('role') === 'viewer' ? 'viewer' : 'organization_admin';
createRoot(document.getElementById('root')!).render(
  <>
    <ContractReadinessBrief data={qualificationData(role)} pursuitId={pursuit} />
    <QualificationWorkspace data={qualificationData(role)} pursuitId={pursuit} />
  </>,
);
