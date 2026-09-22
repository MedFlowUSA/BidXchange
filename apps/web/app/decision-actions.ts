'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import type { MutationState } from './actions';
import { decisionReasons } from '../lib/decision-reasons';
const schema = z.object({
  organization_id: z.uuid(),
  pursuit_id: z.uuid(),
  version: z.iso.datetime({ offset: true }),
  context: z.string().regex(/^[a-f0-9]{32}$/),
  decision: z.enum(['bid', 'no_bid', 'pending', 'draft', 'leaning_bid', 'leaning_pass']),
  reason_code: z
    .string()
    .refine((v) => v === '' || v in decisionReasons)
    .optional(),
  pursuit_hours: z.union([z.literal(''), z.coerce.number().finite().min(0).max(100000)]).optional(),
  reason: z.string().trim().min(1).max(4000),
  conditions: z.string().trim().max(4000),
  acknowledged: z.literal('on'),
});
export async function recordDecision(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  if (process.env.BIDXCHANGE_DECISIONS_ENABLED !== 'true')
    return { message: 'Decision recording is not enabled.' };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { message: 'Choose a decision, explain the reason, and confirm the decision scope.' };
  try {
    const { user, supabase, choices } = await accountContext();
    const d = parsed.data;
    const contractor = process.env.BIDXCHANGE_REGISTER_SIGNOFF_ENABLED === 'true';
    if (!contractor && !['bid', 'no_bid', 'pending'].includes(d.decision))
      return { message: 'Contractor decision memos are not enabled.' };
    if (
      !user ||
      !supabase ||
      !choices.some(
        (c) =>
          c.id === d.organization_id &&
          ['organization_admin', 'executive_approver'].includes(c.role),
      )
    )
      return {
        message: 'An active administrator or executive approver must record this decision.',
      };
    const result = await supabase.rpc('record_pursuit_decision', {
      org: d.organization_id,
      pursuit: d.pursuit_id,
      expected_version: d.version,
      expected_context: d.context,
      outcome: d.decision,
      rationale: d.reason,
      limits: d.conditions,
      ...(contractor
        ? {
            reason_codes: d.reason_code ? [d.reason_code] : [],
            pursuit_hours: typeof d.pursuit_hours === 'number' ? d.pursuit_hours : null,
          }
        : {}),
    });
    if (result.error || !result.data)
      return {
        message:
          'Decision not recorded. Reload changed records, confirm your access, and review again. Your draft has been kept.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Decision recorded with your identity and time. Pricing, certifications and submission need separate authorization.',
    };
  } catch {
    return { message: 'Decision could not be recorded. Try again.' };
  }
}
