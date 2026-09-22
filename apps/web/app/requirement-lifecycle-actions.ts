'use server';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import { requirementLifecycleInput } from '../lib/requirement-lifecycle';
import type { MutationState } from './actions';

export async function changeRequirementLifecycle(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const parsed = requirementLifecycleInput.safeParse(Object.fromEntries(
    Object.keys(requirementLifecycleInput.shape).map((key) => [key, form.get(key)]),
  ));
  if (!parsed.success)
    return { message: parsed.error.issues[0]?.message ?? 'Check the correction fields.' };
  try {
    const d = parsed.data;
    const account = await accountContext();
    const role = account.choices.find((c) => c.id === d.organization_id)?.role;
    if (
      !account.user ||
      !account.supabase ||
      !role ||
      !['organization_admin', 'capture_manager'].includes(role)
    )
      return { message: 'An administrator or capture manager must correct requirements.' };
    const result = await account.supabase.rpc('change_requirement_lifecycle', {
      org: d.organization_id,
      pursuit: d.pursuit_id,
      source: d.requirement_id,
      expected_source: d.expected_source,
      operation: d.operation,
      rationale: d.reason,
      target: d.target_id || null,
      expected_target: d.expected_target || null,
      merged_text: d.operation === 'merge' ? d.merged_text : null,
    });
    if (result.error || !result.data)
      return {
        message:
          'Correction not saved. Reload changed records, select an active target in this pursuit and keep both citations within 2,000 characters. Your entered text is retained.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Correction recorded with your identity and time. Refresh the register, review affected evidence and tasks, and obtain fresh sign-off and approvals.',
    };
  } catch {
    return { message: 'Correction could not be saved. Your entered text is retained; try again.' };
  }
}
