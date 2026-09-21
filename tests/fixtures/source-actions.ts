import type { MutationState } from '../../apps/web/app/actions';
export async function saveSourceSearch(): Promise<MutationState> {
  return { success: true, message: 'Synthetic search saved' };
}
export async function reviewSource(_: MutationState, form: FormData): Promise<MutationState> {
  if (form.get('disposition') === 'converted' && form.get('confirm') !== 'on')
    return { message: 'Confirmation required' };
  return { success: true, message: 'Synthetic review saved; no pursuit created' };
}
