import type { TenantData } from '../lib/tenant-types';
import styles from './task-context.module.css';
import TaskProgressForm from './task-progress-form';
import { canReportTaskProgress } from '../lib/task-progress';

// Task notes are already workspace-visible records. Do not fetch private Passport facts here.
export default function TaskContext({
  data,
  task,
}: {
  data: TenantData;
  task: TenantData['tasks'][number];
}) {
  const requirement = data.requirements?.find(
    (r) => r.id === task.requirement_id && r.pursuit_id === task.pursuit_id,
  );
  const archived = data.archivedRequirements?.find(
    (r) => r.id === task.requirement_id && r.pursuit_id === task.pursuit_id,
  );
  return (
    <div className={styles.context}>
      {task.priority && <p>Priority: {task.priority}</p>}
      {task.notes?.trim() && (
        <>
          <h4>Task instructions and source reference</h4>
          <p className={styles.notes}>{task.notes}</p>
        </>
      )}
      {requirement ? (
        <p>
          Linked requirement:{' '}
          <a href={`#requirement-${requirement.id}`}>{requirement.requirement}</a>
        </p>
      ) : archived ? (
        <p>
          This task remains linked to an archived requirement. Review the{' '}
          <a href="#requirement-archive-title">correction history</a> before completing or updating
          it.
        </p>
      ) : task.requirement_id ? (
        <p>
          The linked requirement is not available in this view. Ask the bid lead to check the
          register before relying on this task.
        </p>
      ) : null}
      <TaskProgressForm data={data} task={task} />
      {task.status !== 'complete' &&
        !canReportTaskProgress(data, task) &&
        !['organization_admin', 'capture_manager'].includes(data.organization.role) && (
          <p>A bid lead or company administrator can update this task after you report progress.</p>
        )}
    </div>
  );
}
