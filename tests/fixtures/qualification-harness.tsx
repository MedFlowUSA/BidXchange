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
if (new URL(location.href).searchParams.has('deadlines')) {
  data.tasks = Array.from({ length: 10 }, (_, index) => ({
    id: `old-${index}`,
    pursuit_id: pursuit,
    title: `Old follow-up ${index}`,
    status: 'todo',
    due_at: '2026-09-19T12:00:00Z',
    due_timezone: 'UTC',
  }));
  data.tasks.push({
    id: 'undated',
    pursuit_id: pursuit,
    title: 'Confirm job walk date',
    status: 'todo',
  });
  data.tasks.push({
    id: 'after',
    pursuit_id: pursuit,
    title: 'Check late bond request',
    status: 'todo',
    due_at: '2026-09-22T12:00:00Z',
    due_timezone: 'UTC',
  });
}
if (new URL(location.href).searchParams.has('calendar-empty')) {
  data.tasks = [];
  data.opportunities[0].official_deadline = null;
}
createRoot(document.getElementById('root')!).render(
  <>
    <ContractReadinessBrief data={qualificationData(role)} pursuitId={pursuit} />
    <DeliveryReview data={qualificationData(role)} pursuitId={pursuit} />
    <QualificationWorkspace data={data} pursuitId={pursuit} />
  </>,
);
