import { z } from 'zod';
import type { TenantData } from './tenant-types';

export const taskInboxPageSize = 25;
export const taskInboxMaxPage = 1000;
export const taskInboxFilters = z.object({
  owner: z.enum(['all', 'mine', 'unassigned']),
  timing: z.enum(['all', 'overdue', 'week', 'undated']),
  page: z.number().int().min(0).max(taskInboxMaxPage),
});
export type TaskInboxFilters = z.infer<typeof taskInboxFilters>;
export type TaskInbox = {
  filters: TaskInboxFilters;
  asOf: string;
  rows: { task: TenantData['tasks'][number]; pursuitTitle: string | null }[];
  hasNext: boolean;
  error?: boolean;
};

export function parseTaskInboxFilters(
  query: Record<string, string | string[] | undefined>,
  role: string,
) {
  const page = z
    .string()
    .regex(/^(0|[1-9]\d{0,3})$/)
    .safeParse(query.task_page ?? '0');
  return taskInboxFilters.safeParse({
    owner:
      query.task_owner ??
      (['contributor', 'estimator', 'executive_approver'].includes(role) ? 'mine' : 'all'),
    timing: query.task_timing ?? 'all',
    page: page.success ? Number(page.data) : NaN,
  });
}
export function taskInboxHref(organizationId: string, filters: TaskInboxFilters) {
  const query = new URLSearchParams({
    organization: organizationId,
    task_owner: filters.owner,
    task_timing: filters.timing,
    task_page: String(filters.page),
  });
  return `/dashboard?${query}#today-tasks-heading`;
}
