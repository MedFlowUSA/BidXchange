'use server';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import { opportunityInput, pursuitInput, taskInput, requirementInput } from '../lib/capture-input';
import type { MutationState } from './actions';

async function captureAccess(organizationId: string) {
  const account = await accountContext();
  if (
    !account.user ||
    !account.supabase ||
    !account.choices.some(
      (choice) =>
        choice.id === organizationId &&
        ['organization_admin', 'capture_manager'].includes(choice.role),
    )
  )
    throw new Error('access');
  const limit = await account.supabase.rpc('consume_admin_mutation');
  if (limit.error || limit.data !== true) throw new Error('limit');
  return account.supabase;
}
const unavailable = {
  message: 'Could not save. Check capture access, wait a minute, and try again.',
};
const changed = {
  message:
    'The record changed or is unavailable. Refresh before editing again. Your text has been kept.',
};

export async function saveRequirement(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const parsed = requirementInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { message: parsed.error.issues[0]?.message ?? 'Check the requirement fields.' };
  try {
    const { organization_id, record_id, updated_at, ...input } = parsed.data;
    const db = await captureAccess(organization_id);
    const parent = await db
      .from('pursuits')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('id', input.pursuit_id)
      .single();
    if (parent.error) return unavailable;
    if (input.owner_user_id) {
      const owner = await db
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', organization_id)
        .eq('user_id', input.owner_user_id)
        .eq('status', 'active')
        .maybeSingle();
      if (owner.error || !owner.data)
        return {
          message: 'Choose an active organization member or leave the requirement unassigned.',
        };
    }
    const values = { ...input, owner_user_id: input.owner_user_id || null };
    const result = record_id
      ? await db
          .from('pursuit_requirements')
          .update(values)
          .eq('organization_id', organization_id)
          .eq('pursuit_id', input.pursuit_id)
          .eq('id', record_id)
          .eq('updated_at', updated_at)
          .select('id')
      : await db
          .from('pursuit_requirements')
          .insert({ ...values, organization_id })
          .select('id');
    if (result.error) return unavailable;
    if (!result.data?.length) return changed;
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'Requirement saved for follow-up. Compliance and eligibility have not been verified.',
    };
  } catch {
    return unavailable;
  }
}

export async function saveOpportunity(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const parsed = opportunityInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Check the fields.' };
  try {
    const { organization_id, record_id, updated_at, ...input } = parsed.data;
    const db = await captureAccess(organization_id);
    const values = {
      ...input,
      buyer: input.buyer || null,
      solicitation_number: input.solicitation_number || null,
      source_url: input.source_url || null,
      source_note: input.source_note || null,
      summary: input.summary || null,
      official_deadline: input.official_deadline || null,
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
    if (result.error) return unavailable;
    if (!result.data?.length) return changed;
    revalidatePath('/', 'layout');
    return {
      success: true,
      message: 'Opportunity saved. Qualification and bid decision still require review.',
      href: `/opportunities/${result.data[0].id}?organization=${organization_id}`,
    };
  } catch {
    return unavailable;
  }
}

export async function startPursuit(_state: MutationState, form: FormData): Promise<MutationState> {
  const parsed = pursuitInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: 'Choose an available opportunity.' };
  try {
    const { organization_id, opportunity_id } = parsed.data;
    const db = await captureAccess(organization_id);
    const opportunity = await db
      .from('opportunities')
      .select('title')
      .eq('organization_id', organization_id)
      .eq('id', opportunity_id)
      .single();
    if (opportunity.error) return unavailable;
    // Existing workspaces are surfaced by the caller. This check also handles ordinary retries.
    const existing = await db
      .from('pursuits')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('opportunity_id', opportunity_id)
      .limit(1);
    if (existing.error) return unavailable;
    if (existing.data?.length)
      return {
        message: 'A pursuit already exists. Continue in its workspace.',
        href: `/pursuits/${existing.data[0].id}?organization=${organization_id}`,
      };
    const result = await db
      .from('pursuits')
      .insert({
        organization_id,
        opportunity_id,
        title: opportunity.data.title,
        decision: 'pending',
        status: 'in_review',
      })
      .select('id');
    if (result.error || !result.data?.length) return unavailable;
    revalidatePath('/', 'layout');
    return {
      success: true,
      message: 'Planning workspace created. Open the pursuit below. Bid decision remains pending.',
      href: `/pursuits/${result.data[0].id}?organization=${organization_id}`,
    };
  } catch {
    return unavailable;
  }
}

export async function savePursuitTask(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const parsed = taskInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { message: parsed.error.issues[0]?.message ?? 'Check the task fields.' };
  try {
    const { organization_id, record_id, updated_at, ...input } = parsed.data;
    const db = await captureAccess(organization_id);
    const parent = await db
      .from('pursuits')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('id', input.pursuit_id)
      .single();
    if (parent.error) return unavailable;
    if (input.assigned_user_id) {
      const member = await db
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', organization_id)
        .eq('user_id', input.assigned_user_id)
        .eq('status', 'active')
        .maybeSingle();
      if (member.error || !member.data)
        return { message: 'Choose an active organization member or leave the task unassigned.' };
    }
    const values = {
      ...input,
      assigned_user_id: input.assigned_user_id || null,
      due_at: input.due_at || null,
    };
    const result = record_id
      ? await db
          .from('pursuit_tasks')
          .update(values)
          .eq('organization_id', organization_id)
          .eq('pursuit_id', input.pursuit_id)
          .eq('id', record_id)
          .eq('updated_at', updated_at)
          .select('id')
      : await db
          .from('pursuit_tasks')
          .insert({ ...values, organization_id })
          .select('id');
    if (result.error) return unavailable;
    if (!result.data?.length) return changed;
    revalidatePath('/', 'layout');
    return {
      success: true,
      message: 'Task saved. Task completion does not approve a bid or submit a proposal.',
    };
  } catch {
    return unavailable;
  }
}
