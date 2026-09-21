import { createRoot } from 'react-dom/client';
import { PepmaIntake, PepmaWorkflow } from '../../apps/web/components/pepma-workflow';
import { workflowData, pursuit } from './workflow-data';
import '../../apps/web/app/globals.css';
const viewer = new URL(location.href).searchParams.get('role') === 'viewer';
const data = workflowData(viewer ? 'viewer' : 'organization_admin');
createRoot(document.getElementById('root')!).render(
  <main>
    {!viewer && <PepmaIntake data={data} />}
    <PepmaWorkflow data={data} pursuitId={pursuit} canEdit={!viewer} />
    <div id="pursuit-requirements">Requirement register</div>
    <div id="response-packages">Response packages</div>
    <div id="response-release">Submission records</div>
  </main>,
);
