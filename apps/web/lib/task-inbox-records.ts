import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { TenantData } from './tenant-types';
import { taskFields } from './tenant-records';
import {
  taskInboxFilters,
  taskInboxPageSize,
  taskInboxMaxPage,
  type TaskInboxFilters,
  type TaskInbox,
} from './task-inbox';

// Caller supplies the authenticated session client and current user ID.
// Filter before pagination: the workspace search sample is not the inbox source.
export async function loadTaskInbox(
  db: SupabaseClient,
  organizationId: string,
  userId: string,
  filters: TaskInboxFilters,
  asOf = new Date().toISOString(),
): Promise<TaskInbox> {
  if (
    !z.uuid().safeParse(organizationId).success ||
    !z.uuid().safeParse(userId).success ||
    !taskInboxFilters.safeParse(filters).success ||
    !z.iso.datetime({ offset: true }).safeParse(asOf).success
  )
    throw new Error('Invalid task inbox request');
  const empty: TaskInbox = { filters, asOf, rows: [], hasNext: false };
  try {
    let query = db
      .from('pursuit_tasks')
      .select(taskFields)
      .eq('organization_id', organizationId)
      .neq('status', 'complete');
    if (filters.owner === 'mine') query = query.eq('assigned_user_id', userId);
    if (filters.owner === 'unassigned') query = query.is('assigned_user_id', null);
    if (filters.timing === 'overdue') query = query.lt('due_at', asOf);
    if (filters.timing === 'week')
      query = query
        .gte('due_at', asOf)
        .lte('due_at', new Date(Date.parse(asOf) + 7 * 86400000).toISOString());
    if (filters.timing === 'undated') query = query.is('due_at', null);
    const start = filters.page * taskInboxPageSize;
    const tasks = await query
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(start, start + taskInboxPageSize)
      .abortSignal(AbortSignal.timeout(15000))
      .overrideTypes<TenantData['tasks'], { merge: false }>();
    if (tasks.error || !tasks.data) return { ...empty, error: true };
    const rows = tasks.data.slice(0, taskInboxPageSize);
    if (!rows.length) return empty;
    const pursuits = await db
      .from('pursuits')
      .select('id,title')
      .eq('organization_id', organizationId)
      .in('id', [...new Set(rows.map((t) => t.pursuit_id))])
      .limit(taskInboxPageSize)
      .abortSignal(AbortSignal.timeout(15000));
    if (pursuits.error || !pursuits.data) return { ...empty, error: true };
    const titles = new Map(pursuits.data.map((p) => [p.id, p.title as string]));
    return {
      filters,
      asOf,
      rows: rows.map((task) => ({ task, pursuitTitle: titles.get(task.pursuit_id) ?? null })),
      hasNext: tasks.data.length > taskInboxPageSize && filters.page < taskInboxMaxPage,
    };
  } catch {
    return { ...empty, error: true };
  }
}
