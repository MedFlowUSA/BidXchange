'use server';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import { resolutionInput } from '../lib/requirement-resolution';
import type { MutationState } from './actions';
export async function resolveRequirement(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  if (process.env.BIDXCHANGE_RESOLUTIONS_ENABLED !== 'true')
    return { message: 'Requirement resolution is not enabled.' };
  const parsed = resolutionInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { message: parsed.error.issues[0]?.message ?? 'Check the review fields.' };
  try {
    const d = parsed.data,
      account = await accountContext();
    const membership = account.choices.find((c) => c.id === d.organization_id);
    if (
      !account.user ||
      !account.supabase ||
      !membership ||
      !['organization_admin', 'executive_approver'].includes(membership.role)
    )
      return {
        message: 'An active administrator or executive approver must review this requirement.',
      };
    if (d.disposition === 'waived' && membership.role !== 'executive_approver')
      return { message: 'An executive approver must record the documented waiver.' };
    const result = await account.supabase.rpc('resolve_pursuit_requirement', {
      org: d.organization_id,
      target_requirement: d.requirement_id,
      expected_version: d.requirement_version,
      expected_previous: d.previous_id || null,
      outcome: d.disposition,
      rationale: d.reason,
      evidence_review: d.evidence_review_id || null,
      issuing_authority: d.authority_name,
      waiver_reference: d.authority_reference,
    });
    if (result.error || !result.data)
      return {
        message:
          'Review not saved. Reload changed requirements or reviews, check evidence approval and confirm your authority. Your draft has been kept.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Requirement review recorded with your identity and time. Revisit the bid decision if this changes the pursuit.',
    };
  } catch {
    return { message: 'Requirement review could not be saved. Try again.' };
  }
}
