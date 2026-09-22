'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '../../../../lib/supabase/server';

export type SecurityState = { message: string };
export async function signOutAllDevices(_: SecurityState, form: FormData): Promise<SecurityState> {
  if (form.get('confirm') !== 'yes')
    return { message: 'Confirm that you want to sign out all devices, including this one.' };
  try {
    const db = await createSupabaseServer();
    if (!db) return { message: 'Account security is unavailable. Please try again.' };
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return { message: 'Sign in again before managing your sessions.' };
    // Always the authenticated account; no user ID or scope is accepted from the form.
    const result = await db.auth.signOut({ scope: 'global' });
    if (result.error) return { message: 'Sign-out could not be confirmed. Please try again.' };
  } catch {
    return { message: 'Sign-out could not be confirmed. Please try again.' };
  }
  redirect('/login?notice=sessions-ended');
}
