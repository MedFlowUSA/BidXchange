'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../lib/tenant';
export type MutationState = { message: string; success?: boolean; href?: string };
const roles = z.enum([
  'organization_admin',
  'executive_approver',
  'capture_manager',
  'estimator',
  'contributor',
  'viewer',
]);
async function mutate(
  form: FormData,
  kind: 'organization' | 'fact' | 'membership',
): Promise<MutationState> {
  try {
    const organizationId = z.uuid().parse(form.get('organization_id'));
    const { supabase } = await requireAdmin(organizationId);
    const limit = await supabase.rpc('consume_admin_mutation');
    if (limit.error || limit.data !== true)
      return { message: 'Too many changes. Please wait a minute and try again.' };
    let result;
    if (kind === 'organization') {
      const parsed = z
        .object({
          operating_name: z.string().trim().min(1).max(200),
          legal_name: z.string().trim().min(1).max(200),
          website: z.union([
            z.literal(''),
            z.url().refine((v) => v.startsWith('https://'), 'Use an HTTPS URL'),
          ]),
          default_timezone: z.string().refine((v) => {
            try {
              new Intl.DateTimeFormat('en', { timeZone: v });
              return true;
            } catch {
              return false;
            }
          }, 'Invalid timezone'),
        })
        .parse(Object.fromEntries(form));
      result = await supabase
        .from('organizations')
        .update({
          ...parsed,
          website: parsed.website || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizationId)
        .select('id');
    } else if (kind === 'membership') {
      const memberId = z.uuid().parse(form.get('membership_id'));
      const role = roles.parse(form.get('role'));
      result = await supabase
        .from('organization_memberships')
        .update({ role })
        .eq('organization_id', organizationId)
        .eq('id', memberId)
        .select('id');
    } else {
      const factId = z.uuid().parse(form.get('fact_id'));
      const status = z
        .enum(['unverified', 'pending_verification', 'verified', 'expiring', 'expired', 'rejected'])
        .parse(form.get('verification_status'));
      const source = z
        .string()
        .trim()
        .max(2000)
        .parse(form.get('source_reference') ?? '');
      const updatedAt = z.iso.datetime({ offset: true }).parse(form.get('updated_at'));
      const current = await supabase
        .from('profile_facts')
        .select('source_reference')
        .eq('organization_id', organizationId)
        .eq('id', factId)
        .single();
      if (current.error) return { message: 'This fact is unavailable.' };
      if (
        ['verified', 'expiring'].includes(status) &&
        (!source || source !== current.data.source_reference)
      )
        return {
          message:
            'Save the evidence reference as pending verification first, then explicitly verify the saved fact.',
        };
      result = await supabase
        .from('profile_facts')
        .update({ verification_status: status, source_reference: source || null })
        .eq('organization_id', organizationId)
        .eq('id', factId)
        .eq('updated_at', updatedAt)
        .select('id');
    }
    if (result.error)
      return {
        message:
          'Change rejected. Keep at least one active administrator and provide valid evidence for verified facts.',
      };
    if (!result.data?.length)
      return { message: 'The record changed or is not accessible. Refresh before trying again.' };
    revalidatePath('/', 'layout');
    return { message: 'Saved. The change is recorded in organization history.', success: true };
  } catch {
    return { message: 'The request is invalid or you no longer have permission.' };
  }
}
export async function updateOrganization(_state: MutationState, form: FormData) {
  return mutate(form, 'organization');
}
export async function updateFact(_state: MutationState, form: FormData) {
  return mutate(form, 'fact');
}
export async function updateMembership(_state: MutationState, form: FormData) {
  return mutate(form, 'membership');
}
