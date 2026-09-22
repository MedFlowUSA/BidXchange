'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { accountContext } from '../lib/tenant';
export async function acknowledgeReminder(
  _state: { message: string; success?: boolean },
  form: FormData,
) {
  if (process.env.BIDXCHANGE_EVIDENCE_MONITOR_ENABLED !== 'true')
    return { message: 'Scheduled reminders are not enabled.' };
  const parsed = z
    .object({
      organization_id: z.uuid(),
      reminder_id: z.uuid(),
      updated_at: z.iso.datetime({ offset: true }),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: 'Refresh and choose the current reminder.' };
  try {
    const account = await accountContext();
    if (
      !account.user ||
      !account.supabase ||
      !account.choices.some((o) => o.id === parsed.data.organization_id)
    )
      return { message: 'Company access is required.' };
    const { error } = await account.supabase.rpc('acknowledge_evidence_reminder', {
      org: parsed.data.organization_id,
      reminder: parsed.data.reminder_id,
      expected_version: parsed.data.updated_at,
    });
    if (error)
      return {
        message: 'Reminder changed or access is unavailable. Refresh and review the evidence.',
      };
    revalidatePath('/dashboard');
    revalidatePath('/company');
    return {
      success: true,
      message:
        'Acknowledged. The evidence still needs review; its status and affected decisions are unchanged.',
    };
  } catch {
    return { message: 'Acknowledgement unavailable. Please retry.' };
  }
}
