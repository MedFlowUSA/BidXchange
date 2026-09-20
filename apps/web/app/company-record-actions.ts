'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../lib/tenant';
import { companyRecordInput } from '../lib/company-record-input';
import type { MutationState } from './actions';

export async function saveCompanyRecord(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const parsed = companyRecordInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { message: parsed.error.issues[0]?.message ?? 'Check the record fields.' };
  try {
    const input = parsed.data;
    const { supabase } = await requireAdmin(input.organization_id);
    const limit = await supabase.rpc('consume_admin_mutation');
    if (limit.error || limit.data !== true)
      return { message: 'Too many changes. Wait a minute and try again.' };
    const owner = await supabase
      .from('organization_memberships')
      .select('user_id')
      .eq('organization_id', input.organization_id)
      .eq('user_id', input.owner_user_id)
      .eq('status', 'active')
      .maybeSingle();
    if (owner.error || !owner.data)
      return { message: 'Choose an active member of this organization as the owner.' };
    const values = {
      fact_type: input.fact_type,
      label: input.label,
      value: input.value || null,
      source_reference: input.source_reference || null,
      source_note: input.source_note || null,
      owner_user_id: input.owner_user_id,
      effective_date: input.effective_date || null,
      expiration_date: input.expiration_date || null,
      sensitivity: input.sensitivity,
      verification_status: 'pending_verification',
      verified_by: null,
      verified_at: null,
    };
    let result;
    if (input.fact_id) {
      result = await supabase
        .from('profile_facts')
        .update(values)
        .eq('organization_id', input.organization_id)
        .eq('id', input.fact_id)
        .eq('updated_at', input.updated_at)
        .select('id');
    } else {
      let profile = await supabase
        .from('company_profiles')
        .select('id')
        .eq('organization_id', input.organization_id)
        .maybeSingle();
      if (profile.error) return { message: 'Company profile is unavailable. Try again.' };
      if (!profile.data) {
        const created = await supabase
          .from('company_profiles')
          .insert({ organization_id: input.organization_id })
          .select('id')
          .single();
        if (created.error && created.error.code !== '23505')
          return { message: 'Company profile could not be created.' };
        profile = await supabase
          .from('company_profiles')
          .select('id')
          .eq('organization_id', input.organization_id)
          .maybeSingle();
      }
      if (profile.error || !profile.data)
        return { message: 'Company profile is unavailable. Try again.' };
      result = await supabase
        .from('profile_facts')
        .insert({
          ...values,
          organization_id: input.organization_id,
          company_profile_id: profile.data.id,
        })
        .select('id');
    }
    if (result.error)
      return {
        message:
          result.error.code === '23505'
            ? 'A record with this category and label already exists. Edit it or choose a distinct label.'
            : 'The record could not be saved. Check your access and try again.',
      };
    if (!result.data?.length)
      return { message: 'The record changed or is unavailable. Refresh before editing again.' };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Saved for human review. Any previous verification has been cleared. You can return to this record later.',
    };
  } catch {
    return { message: 'The request is invalid or administrator access is no longer available.' };
  }
}
