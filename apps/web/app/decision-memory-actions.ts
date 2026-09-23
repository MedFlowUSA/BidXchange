'use server';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import { memoryReviewSchema } from '../lib/decision-memory';
import type { MutationState } from './actions';

export async function reviewDecisionMemory(
  _: MutationState,
  form: FormData,
): Promise<MutationState> {
  if (process.env.BIDXCHANGE_DECISION_MEMORY_ENABLED !== 'true')
    return { message: 'Decision memory is not enabled.' };
  const parsed = memoryReviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      message:
        'Choose an assessment, explain your basis, provide a source reference and confirm your review.',
    };
  try {
    const { user, supabase, choices } = await accountContext();
    const d = parsed.data;
    if (
      !user ||
      !supabase ||
      !choices.some(
        (c) =>
          c.id === d.organization_id &&
          ['organization_admin', 'executive_approver'].includes(c.role),
      )
    )
      return { message: 'An administrator or executive approver must record this assessment.' };
    const result = await supabase.rpc('review_decision_memory', {
      org: d.organization_id,
      decision: d.decision_id,
      target: d.opportunity_id,
      reason: d.reason_code,
      outcome: d.assessment,
      explanation: d.note,
      reference: d.source_reference,
      expected_context: d.context,
      expected_previous: d.previous || null,
    });
    if (result.error || !result.data)
      return {
        message:
          'Assessment not saved. Records or reviews may have changed. Refresh and review again.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Human assessment recorded for this notice. No requirement or bid decision was changed.',
    };
  } catch {
    return { message: 'Assessment could not be recorded. Try again.' };
  }
}
