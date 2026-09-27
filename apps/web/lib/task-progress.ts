import { z } from 'zod';
import type { TenantData } from './tenant-types';

export const taskProgressInput = z.object({
  organization_id: z.uuid(),
  pursuit_id: z.uuid(),
  record_id: z.uuid(),
  updated_at: z.iso.datetime({ offset: true }),
  status: z.enum(['todo', 'in_progress', 'complete']),
});

export function canReportTaskProgress(data: TenantData, task: TenantData['tasks'][number]) {
  return Boolean(
    task.updated_at &&
    task.assigned_user_id === data.userId &&
    ['contributor', 'estimator', 'executive_approver'].includes(data.organization.role),
  );
}
