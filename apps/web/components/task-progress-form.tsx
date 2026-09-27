'use client';
import { CaptureForm } from './capture-forms';
import { saveTaskProgress } from '../app/task-progress-actions';
import { canReportTaskProgress } from '../lib/task-progress';
import type { TenantData } from '../lib/tenant-types';

export default function TaskProgressForm({
  data,
  task,
}: {
  data: TenantData;
  task: TenantData['tasks'][number];
}) {
  if (!canReportTaskProgress(data, task)) return null;
  return (
    <CaptureForm
      label="Update my task progress"
      action={saveTaskProgress}
      hidden={{
        organization_id: data.organization.id,
        pursuit_id: task.pursuit_id,
        record_id: task.id,
        updated_at: task.updated_at!,
      }}
      initial={{ status: task.status }}
      fields={[
        {
          name: 'status',
          label: 'Task progress',
          required: true,
          options: [
            { value: 'todo', label: 'Not started' },
            { value: 'in_progress', label: 'In progress' },
            { value: 'complete', label: 'Complete' },
          ],
        },
      ]}
      note="Report progress on your assigned work. Completing a task does not approve evidence or submit a bid. Ask the bid lead to change its instructions, owner or deadline."
    />
  );
}
