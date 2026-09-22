import type { TenantData } from '../lib/tenant-types';
import { contractorTasks } from '../lib/contractor-tasks';
import { TaskForm } from './capture-forms';
export default function ContractorTaskTemplate({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  if (!['organization_admin', 'capture_manager'].includes(data.organization.role)) return null;
  return (
    <details className="panel">
      <summary>Choose California contractor follow-up tasks</summary>
      <p>
        Add only applicable work. Each task needs a human owner and a deadline; these suggestions do
        not establish notice requirements.
      </p>
      {contractorTasks.map((title) => (
        <div key={title}>
          <h3>{title}</h3>
          {data.tasks.some((t) => t.pursuit_id === pursuitId && t.title === title) ? (
            <p>Already recorded in this pursuit; review the existing task.</p>
          ) : (
            <TaskForm data={data} pursuitId={pursuitId} suggestedTitle={title} />
          )}
        </div>
      ))}
    </details>
  );
}
