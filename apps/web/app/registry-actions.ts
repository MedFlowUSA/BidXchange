'use server';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import { normalizedInput, registrationInput } from '../lib/sources/normalized';
import { findSource } from '../lib/sources/registry';
import type { MutationState } from './actions';

async function access(org: string, admin = false) {
  const account = await accountContext();
  if (
    !account.user ||
    !account.supabase ||
    !account.choices.some(
      (c) =>
        c.id === org &&
        (admin
          ? c.role === 'organization_admin'
          : ['organization_admin', 'capture_manager'].includes(c.role)),
    )
  )
    throw new Error('access');
  const limit = await account.supabase.rpc('consume_admin_mutation');
  if (limit.error || limit.data !== true) throw new Error('limit');
  return account.supabase;
}
export async function saveSourceRegistration(
  _: MutationState,
  form: FormData,
): Promise<MutationState> {
  const parsed = registrationInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Check the fields.' };
  try {
    const { organization_id, source_id, updated_at, ...fields } = parsed.data;
    const db = await access(organization_id, true);
    const values = { ...fields, expires_on: fields.expires_on || null };
    const result = updated_at
      ? await db
          .from('source_registrations')
          .update(values)
          .eq('organization_id', organization_id)
          .eq('source_id', source_id)
          .eq('updated_at', updated_at)
          .select('id')
      : await db
          .from('source_registrations')
          .insert({ ...values, organization_id, source_id })
          .select('id');
    if (result.error || !result.data?.length)
      return {
        message: 'Not saved. Refresh to check access or a newer version. Your draft is preserved.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Registration evidence saved. This does not authenticate or connect the external portal.',
    };
  } catch {
    return { message: 'Could not save. Check administrator access and retry.' };
  }
}
export async function saveNormalizedOpportunity(
  _: MutationState,
  form: FormData,
): Promise<MutationState> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get('details')));
  } catch {
    return { message: 'Check the source detail fields.' };
  }
  const parsed = normalizedInput.safeParse({ ...Object.fromEntries(form), details: raw });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Check the fields.' };
  const source = findSource(parsed.data.details.sourceId)!;
  if (source.group !== 'opportunities')
    return {
      message:
        'Contract vehicles and award research are not open-bid opportunities. Manage them in the registry.',
    };
  try {
    const {
      organization_id,
      record_id,
      updated_at,
      details,
      confirmed: _confirmed,
      ...fields
    } = parsed.data;
    void _confirmed;
    const db = await access(organization_id);
    const values = {
      ...fields,
      source_details: details,
      official_deadline: fields.official_deadline || null,
      estimated_value: fields.estimated_value ? Number(fields.estimated_value) : null,
    };
    const result = record_id
      ? await db
          .from('opportunities')
          .update(values)
          .eq('organization_id', organization_id)
          .eq('id', record_id)
          .eq('updated_at', updated_at)
          .select('id')
      : await db
          .from('opportunities')
          .insert({ ...values, organization_id, status: 'inbox' })
          .select('id');
    if (result.error || !result.data?.length)
      return {
        message:
          'Not saved. Check your access, current record version and any source eligibility gate. Your draft is preserved.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Opportunity saved with manual provenance. No portal synchronization or submission occurred.',
      href: `/opportunities/${result.data[0].id}?organization=${organization_id}`,
    };
  } catch {
    return { message: 'Could not save. Check capture access and try again.' };
  }
}
