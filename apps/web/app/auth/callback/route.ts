import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '../../../lib/supabase/server';
import { safeNext } from '../../../lib/routes';
export async function GET(request: NextRequest) {
  // Use the configured public origin: the framework's internal request host can differ.
  const origin = process.env.SITE_URL;
  if (!origin) return new NextResponse('Sign-in callback is not configured.', { status: 503 });
  const supabase = await createSupabaseServer();
  const code = request.nextUrl.searchParams.get('code');
  const hash = request.nextUrl.searchParams.get('token_hash');
  if (supabase) {
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : hash && /^[a-zA-Z0-9_-]{20,256}$/.test(hash)
        ? await supabase.auth.verifyOtp({ token_hash: hash, type: 'email' })
        : null;
    if (result?.error)
      console.warn('Passwordless callback rejected:', result.error.code ?? 'auth_error');
    if (result && !result.error)
      return NextResponse.redirect(
        new URL(safeNext(request.nextUrl.searchParams.get('next')), origin),
      );
  }
  return NextResponse.redirect(new URL('/login?error=callback', origin));
}
