'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import type { MutationState } from './actions';
const input = z.object({
  organization_id: z.uuid(),
  pursuit_id: z.uuid(),
  context: z.string().regex(/^[a-f0-9]{32}$/),
  note: z.string().trim().min(1).max(4000),
  acknowledged: z.literal('on'),
});
export async function signOffRegister(_: MutationState, form: FormData): Promise<MutationState> {
  if (process.env.BIDXCHANGE_REGISTER_SIGNOFF_ENABLED !== 'true')
    return { message: 'Register sign-off is not enabled.' };
  const parsed = input.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { message: 'Add a review note and acknowledge your review of the register.' };
  try {
    const account = await accountContext();
    const d = parsed.data;
    if (
      !account.user ||
      !account.supabase ||
      !account.choices.some(
        (c) =>
          c.id === d.organization_id &&
          ['organization_admin', 'executive_approver'].includes(c.role),
      )
    )
      return { message: 'An owner or approver must sign off the register.' };
    const result = await account.supabase.rpc('sign_off_requirements_register', {
      org: d.organization_id,
      pursuit: d.pursuit_id,
      expected_context: d.context,
      review_note: d.note,
    });
    if (result.error)
      return {
        message:
          'Sign-off not saved. Confirm citations and refresh changed records before reviewing again.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Human register sign-off recorded. This does not determine legal eligibility or approve submission.',
    };
  } catch {
    return { message: 'Sign-off unavailable. Your review note has been kept.' };
  }
}
