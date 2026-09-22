'use server';
import { z } from 'zod';
import { accountContext } from '../lib/tenant';
import { revalidatePath } from 'next/cache';
import type { MutationState } from './actions';
const input = z.object({
  organization_id: z.uuid(),
  opportunity_id: z.uuid(),
  label: z.string().trim().min(1).max(200),
  issued_on: z.union([z.iso.date(), z.literal('')]),
  source_url: z
    .url({ protocol: /^https$/ })
    .max(2000)
    .refine((v) => {
      const u = new URL(v);
      return !u.username && !u.password;
    }),
  summary: z.string().trim().min(1).max(4000),
  notice_text: z.string().trim().max(24000),
});
export async function recordAmendment(_: MutationState, form: FormData): Promise<MutationState> {
  if (process.env.BIDXCHANGE_CONTRACTOR_WORKFLOW_ENABLED !== 'true')
    return { message: 'Amendment records are not enabled.' };
  const parsed = input.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { message: 'Check amendment label, official HTTPS URL, date and summary.' };
  try {
    const a = await accountContext();
    const d = parsed.data;
    if (
      !a.user ||
      !a.supabase ||
      !a.choices.some(
        (c) =>
          c.id === d.organization_id && ['organization_admin', 'capture_manager'].includes(c.role),
      )
    )
      return { message: 'An owner or bid lead must record this amendment.' };
    const limit = await a.supabase.rpc('consume_admin_mutation');
    if (limit.error || limit.data !== true)
      return { message: 'Too many changes. Try again shortly.' };
    const result = await a.supabase
      .from('opportunity_amendments')
      .insert({ ...d, issued_on: d.issued_on || null, reviewed: false });
    if (result.error)
      return { message: 'Amendment could not be recorded. Confirm your access and retry.' };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Amendment recorded. Requirements need review; previous register sign-off and final decision context are stale. Review and reaffirm them.',
    };
  } catch {
    return { message: 'Amendment recording unavailable. Try again.' };
  }
}

export async function reviewAmendment(_: MutationState, form: FormData): Promise<MutationState> {
  if (process.env.BIDXCHANGE_CONTRACTOR_WORKFLOW_ENABLED !== 'true')
    return { message: 'Amendment records are not enabled.' };
  const parsed = z
    .object({
      organization_id: z.uuid(),
      amendment_id: z.uuid(),
      updated_at: z.iso.datetime({ offset: true }),
      acknowledgment: z.literal('reviewed'),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: 'Confirm your review of this amendment.' };
  try {
    const a = await accountContext();
    const d = parsed.data;
    if (
      !a.user ||
      !a.supabase ||
      !a.choices.some(
        (c) =>
          c.id === d.organization_id && ['organization_admin', 'capture_manager'].includes(c.role),
      )
    )
      return { message: 'An owner or bid lead must record amendment review.' };
    const limit = await a.supabase.rpc('consume_admin_mutation');
    if (limit.error || limit.data !== true)
      return { message: 'Too many changes. Try again shortly.' };
    const result = await a.supabase
      .from('opportunity_amendments')
      .update({ reviewed: true })
      .eq('organization_id', d.organization_id)
      .eq('id', d.amendment_id)
      .eq('updated_at', d.updated_at)
      .eq('reviewed', false)
      .select('id')
      .maybeSingle();
    if (result.error || !result.data)
      return { message: 'The amendment changed or is unavailable. Refresh and review it again.' };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Human review recorded. Review the affected requirements and sign off the register before reaffirming a final decision.',
    };
  } catch {
    return { message: 'Amendment review unavailable. Try again.' };
  }
}
