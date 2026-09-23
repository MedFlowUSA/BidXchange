'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import {
  comparisonInput,
  compareClauses,
  type ComparisonRequirement,
} from '../lib/amendment-comparison';
import type { MutationState } from './actions';

async function captureAccount(org: string) {
  if (process.env.BIDXCHANGE_AMENDMENT_COMPARISON_ENABLED !== 'true') throw Error();
  const account = await accountContext();
  if (
    !account.user ||
    !account.supabase ||
    !account.choices.some(
      (c) => c.id === org && ['organization_admin', 'capture_manager'].includes(c.role),
    )
  )
    throw Error();
  return account.supabase;
}
export async function saveComparison(_: MutationState, form: FormData): Promise<MutationState> {
  const parsed = comparisonInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      message:
        'Provide both public excerpts, official HTTPS links and an amendment label. Confirm that the excerpts are public.',
    };
  try {
    const d = parsed.data,
      db = await captureAccount(d.organization_id);
    const pursuits = await db
      .from('pursuits')
      .select('id')
      .eq('organization_id', d.organization_id)
      .eq('opportunity_id', d.opportunity_id)
      .limit(201);
    if (pursuits.error || (pursuits.data?.length ?? 0) > 200) throw Error();
    let requirements: ComparisonRequirement[] = [];
    if (pursuits.data?.length) {
      const r = await db
        .from('pursuit_requirements')
        .select('id,requirement,status,updated_at')
        .eq('organization_id', d.organization_id)
        .in(
          'pursuit_id',
          pursuits.data.map((p) => p.id),
        )
        .limit(201);
      if (r.error || (r.data?.length ?? 0) > 200)
        return {
          message:
            'This register exceeds the comparison limit of 200 requirements. Review the amendment manually.',
        };
      requirements = (r.data ?? []).map((r) => ({
        id: r.id,
        text: r.requirement,
        status: r.status,
        version: r.updated_at,
      }));
    }
    const result = await db.rpc('save_amendment_comparison', {
      org: d.organization_id,
      target: d.opportunity_id,
      expected_context: d.context,
      title: d.label,
      old_url: d.original_url,
      new_url: d.amended_url,
      old_text: d.original_text,
      new_text: d.amended_text,
      candidates: compareClauses(d.original_text, d.amended_text, requirements),
    });
    if (result.error || !result.data)
      return {
        message:
          'Comparison not saved. Records may have changed or the excerpts may be too large. Refresh and try again; your text remains here.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message: 'Comparison saved for human review. No amendment or requirement status has changed.',
    };
  } catch {
    return { message: 'Comparison unavailable. Confirm your workspace access and try again.' };
  }
}
const confirmation = z.object({
  organization_id: z.uuid(),
  comparison_id: z.uuid(),
  outcome: z.enum(['confirmed', 'dismissed']),
  note: z.string().trim().min(1).max(4000),
  acknowledged: z.literal('on'),
  affected: z.array(z.uuid()).max(200),
});
export async function confirmComparison(_: MutationState, form: FormData): Promise<MutationState> {
  const parsed = confirmation.safeParse({
    ...Object.fromEntries(form),
    affected: form.getAll('affected'),
  });
  if (!parsed.success)
    return {
      message: 'Choose a review outcome, provide your findings and acknowledge the impact.',
    };
  try {
    const d = parsed.data,
      db = await captureAccount(d.organization_id);
    const result = await db.rpc('confirm_amendment_comparison', {
      org: d.organization_id,
      comparison: d.comparison_id,
      choice: d.outcome,
      explanation: d.note,
      affected: d.affected,
      acknowledged: true,
    });
    if (result.error || !result.data)
      return {
        message:
          'Review not saved. The comparison may already be reviewed or its source context changed. Refresh; create a new comparison if needed.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        d.outcome === 'confirmed'
          ? 'Amendment recorded by you. All related requirements need review; previous register sign-off and decision context are stale.'
          : 'Comparison dismissed. No requirement or amendment changed.',
    };
  } catch {
    return { message: 'Review unavailable. Confirm your workspace access and try again.' };
  }
}
