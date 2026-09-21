import { createRoot } from 'react-dom/client';
import QualificationWorkspace from '../../apps/web/components/qualification-workspace';
import { qualificationData } from './qualification-data';
import { pursuit } from './workflow-data';
import '../../apps/web/app/globals.css';
const role =
  new URL(location.href).searchParams.get('role') === 'viewer' ? 'viewer' : 'organization_admin';
createRoot(document.getElementById('root')!).render(
  <QualificationWorkspace data={qualificationData(role)} pursuitId={pursuit} />,
);
