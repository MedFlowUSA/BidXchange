'use server';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import { informationRequestInput } from '../lib/information-requests';
import type { MutationState } from './actions';
export async function saveInformationRequest(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const parsed = informationRequestInput.safeParse(
    Object.fromEntries(
      Object.keys(informationRequestInput.shape).map((key) => [key, form.get(key)]),
    ),
  );
  if (!parsed.success)
    return { message: parsed.error.issues[0]?.message ?? 'Check the request fields.' };
  try {
    const d = parsed.data;
    const account = await accountContext();
    const role = account.choices.find((c) => c.id === d.organization_id)?.role;
    if (!account.user || !account.supabase || !role || role === 'viewer')
      return { message: 'Request access is unavailable.' };
    const result = await account.supabase.rpc('save_information_request', {
      org: d.organization_id,
      request_id: d.record_id || null,
      expected_version: d.updated_at || null,
      request_label: d.label,
      assignee: d.assigned_user_id || null,
      due_date: d.due_on || null,
      request_status: d.status,
      request_notes: d.notes,
      section_key: d.passport_section || null,
      item_key: d.passport_item || null,
    });
    if (result.error || !result.data)
      return {
        message:
          'Request not saved. Refresh changed records, check your assignment, or open the existing request if this item is already listed. Your entered text is retained.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Request saved in the company workspace. No email was sent and no evidence was approved.',
    };
  } catch {
    return { message: 'Could not save the request. Your entered text is retained; try again.' };
  }
}
