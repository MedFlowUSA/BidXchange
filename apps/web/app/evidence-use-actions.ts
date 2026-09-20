'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import type { MutationState } from './actions';
const input = z.object({
  organization_id: z.uuid(),
  requirement_id: z.uuid(),
  fact_id: z.uuid(),
  fact_version: z.iso.datetime({ offset: true }),
  requirement_version: z.iso.datetime({ offset: true }),
  applicability: z.enum(['unknown', 'applicable', 'not_applicable']),
  proposal_use: z.enum(['not_approved', 'approved']),
  reason: z.string().trim().min(1).max(2000),
});
export async function reviewEvidenceUse(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  if (process.env.BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED !== 'true')
    return { message: 'Evidence-use reviews are not enabled.' };
  const parsed = input.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { message: 'Select evidence and provide the review decision and reason.' };
  try {
    const account = await accountContext();
    if (
      !account.user ||
      !account.supabase ||
      !account.choices.some(
        (choice) =>
          choice.id === parsed.data.organization_id &&
          ['organization_admin', 'executive_approver'].includes(choice.role),
      )
    )
      return { message: 'An active administrator or executive approver must review evidence use.' };
    const result = await account.supabase
      .from('evidence_use_reviews')
      .insert(parsed.data)
      .select('id');
    if (result.error || !result.data?.length)
      return {
        message:
          'Review not saved. Refresh changed evidence or requirements, check verification and dates, and confirm your access.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Review saved for this evidence version and requirement. It does not approve the bid, pricing or submission.',
    };
  } catch {
    return { message: 'Review could not be saved. Try again.' };
  }
}
