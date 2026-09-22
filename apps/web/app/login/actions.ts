'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '../../lib/supabase/server';
import { safeNext } from '../../lib/routes';
import { signInUnavailable } from '../../lib/sign-in-recovery';

export type AuthState = { message: string; sent?: boolean };
export async function requestSignIn(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = z.string().trim().pipe(z.email().max(254)).safeParse(form.get('email'));
  if (!email.success) return { message: 'Enter a valid email address.' };
  try {
    const supabase = await createSupabaseServer();
    if (!supabase) return { message: signInUnavailable };
    const site = process.env.SITE_URL;
    if (!site) return { message: signInUnavailable };
    const next = safeNext(form.get('next'));
    const { error } = await supabase.auth.signInWithOtp({
      email: email.data,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // Supabase enforces persistent provider-side email rate limits. Do not disclose account existence.
    if (error?.status === 429)
      return { message: 'Please wait before requesting another sign-in email.' };
    if (error && !['user_not_found', 'signup_disabled'].includes(error.code ?? ''))
      return {
        message:
          'The sign-in email could not be sent. Please try again or contact your administrator.',
      };
    return {
      message:
        'If this email has access, a sign-in link is on its way. Open it in this browser. You can also enter a one-time code if your email contains one.',
      sent: true,
    };
  } catch {
    return { message: signInUnavailable };
  }
}
export async function verifyCode(_state: AuthState, form: FormData): Promise<AuthState> {
  const input = z
    .object({
      email: z.string().trim().pipe(z.email().max(254)),
      token: z
        .string()
        .trim()
        .regex(/^\d{6,8}$/),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { message: 'Enter your email and the one-time code from your email.' };
  try {
    const supabase = await createSupabaseServer();
    if (!supabase) return { message: signInUnavailable };
    const { error } = await supabase.auth.verifyOtp({ ...input.data, type: 'email' });
    if (error) return { message: 'That code is invalid or expired. Request a new sign-in email.' };
  } catch {
    return { message: signInUnavailable };
  }
  redirect(safeNext(form.get('next')));
}
export async function signOut() {
  const supabase = await createSupabaseServer();
  if (supabase) await supabase.auth.signOut({ scope: 'local' });
  redirect('/login');
}
