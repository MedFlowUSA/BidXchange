'use server';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import { taskProgressInput } from '../lib/task-progress';
import type { MutationState } from './actions';

export async function saveTaskProgress(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const parsed = taskProgressInput.safeParse(
    Object.fromEntries(Object.keys(taskProgressInput.shape).map((key) => [key, form.get(key)])),
  );
  if (!parsed.success)
    return { message: 'Choose a task status, or refresh to load the latest task.' };
  try {
    const d = parsed.data;
    const account = await accountContext();
    const role = account.choices.find((c) => c.id === d.organization_id)?.role;
    if (!account.user || !account.supabase || !role || role === 'viewer')
      return { message: 'An active task assignment and editing role are required.' };
    const result = await account.supabase.rpc('update_pursuit_task_progress', {
      org: d.organization_id,
      pursuit: d.pursuit_id,
      task_id: d.record_id,
      expected_version: d.updated_at,
      progress_status: d.status,
    });
    if (result.error || !result.data)
      return {
        message:
          'Progress not saved. Refresh to check the latest task and your assignment, then try again. Your selection is retained.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message: 'Task progress saved. Requirement reviews and bid approvals are unchanged.',
    };
  } catch {
    return { message: 'Could not save progress. Your selection is retained; try again.' };
  }
}
