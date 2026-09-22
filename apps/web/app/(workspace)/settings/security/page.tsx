import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '../../../../lib/supabase/server';
import SecurityForm from './form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Account security | BidXchange',
  robots: { index: false, follow: false },
};
export default async function SecurityPage() {
  const db = await createSupabaseServer();
  if (!db) redirect('/login?next=%2Fsettings%2Fsecurity');
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) redirect('/login?next=%2Fsettings%2Fsecurity');
  const { user } = data;
  const claims = await db.auth.getClaims();
  const aal = claims.error ? null : claims.data?.claims.aal;
  const factors = user.factors?.filter((factor) => factor.status === 'verified').length ?? 0;
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <h1>Account security</h1>
        <p>
          Signed in as {user.email}. These controls apply to your account across all company
          workspaces.
        </p>
        <h2>Current sign-in</h2>
        <p>Email confirmation: {user.email_confirmed_at ? 'Confirmed' : 'Not confirmed'}.</p>
        <p>
          Session verification:{' '}
          {aal === 'aal2'
            ? 'Second factor verified for this session'
            : aal === 'aal1'
              ? 'First-factor session'
              : 'Could not determine; refresh and try again'}
          .
        </p>
        <p>Verified authentication factors on your account: {factors}.</p>
        <p>
          Mandatory multi-factor enforcement and self-service authenticator setup are not enabled in
          BidXchange yet. A verified factor does not mean every application action requires it.
        </p>
        <h2>End account sessions</h2>
        <SecurityForm />
        <p>
          <Link href="/settings">Return to account and organization</Link> ·{' '}
          <Link href="/dashboard">Open workspace</Link>
        </p>
        <a href="mailto:mrodriguez@oaisinc.com?subject=BidXchange%20account%20security">
          Contact support about account access
        </a>
        <p>Never share sign-in links, codes, authenticator secrets or passwords with support.</p>
      </section>
    </main>
  );
}
