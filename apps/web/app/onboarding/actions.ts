'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { accountContext } from '../../lib/tenant';
import { companyCreationInput, invitationInput } from '../../lib/workspace-onboarding';

export type OnboardingState = { message: string; success?: boolean };
async function enabledAccount() {
  if (process.env.BIDXCHANGE_SELF_SERVICE_ENABLED !== 'true') return null;
  const account = await accountContext();
  return account.user?.email_confirmed_at && account.supabase ? account : null;
}
const unavailable = {
  message: 'Confirm your email and sign in again. Company setup may be temporarily unavailable.',
};

export async function createCompany(
  _state: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const input = companyCreationInput.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { message: 'Enter the legal company name and operating name (up to 200 characters).' };
  const account = await enabledAccount();
  if (!account?.supabase) return unavailable;
  const { data, error } = await account.supabase.rpc('create_company_workspace', input.data);
  if (error || !z.uuid().safeParse(data).success)
    return {
      message:
        error?.message === 'Contact support to create additional companies'
          ? 'You have reached the three-company setup limit. Contact BidXchange for additional companies.'
          : 'Company setup could not be completed. Retry with this form; a repeated request will not create a duplicate.',
    };
  revalidatePath('/dashboard');
  redirect(`/onboarding?organization=${data}`);
}

export async function acceptInvitation(
  _state: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const id = z.uuid().safeParse(form.get('invitation_id'));
  if (!id.success) return { message: 'Choose an available invitation.' };
  const account = await enabledAccount();
  if (!account?.supabase) return unavailable;
  const { data, error } = await account.supabase.rpc('accept_company_invitation', {
    invitation_id: id.data,
  });
  if (error || !z.uuid().safeParse(data).success)
    return {
      message:
        'This invitation is unavailable, expired or does not match your confirmed email. Ask the company administrator to review it.',
    };
  revalidatePath('/dashboard');
  redirect(`/dashboard?organization=${data}`);
}

export async function inviteMember(
  _state: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const input = invitationInput.safeParse(Object.fromEntries(form));
  if (!input.success) return { message: 'Enter a valid work email and choose a role.' };
  const account = await enabledAccount();
  if (!account?.supabase) return unavailable;
  if (
    !account.choices.some(
      (o) => o.id === input.data.organization_id && o.role === 'organization_admin',
    )
  )
    return { message: 'Only this company’s administrator can create invitations.' };
  const { error } = await account.supabase.rpc('invite_company_member', {
    org: input.data.organization_id,
    invite_email: input.data.email,
    invite_role: input.data.role,
  });
  if (error)
    return {
      message:
        'Invitation could not be created. Check existing members and pending invitations; at most 50 invitations can be created per company per day.',
    };
  revalidatePath('/settings/team');
  return {
    message:
      'Invitation created for seven days. Share the join address below with this person. No invitation email was sent.',
    success: true,
  };
}

export async function revokeInvitation(
  _state: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const input = z
    .object({ organization_id: z.uuid(), invitation_id: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { message: 'Choose a pending invitation.' };
  const account = await enabledAccount();
  if (!account?.supabase) return unavailable;
  if (
    !account.choices.some(
      (o) => o.id === input.data.organization_id && o.role === 'organization_admin',
    )
  )
    return { message: 'Only this company’s administrator can revoke invitations.' };
  const { data, error } = await account.supabase.rpc('revoke_company_invitation', {
    org: input.data.organization_id,
    invitation_id: input.data.invitation_id,
  });
  if (error || !data)
    return {
      message: 'Invitation is no longer pending or could not be revoked. Refresh this page.',
    };
  revalidatePath('/settings/team');
  return { message: 'Invitation revoked.', success: true };
}
