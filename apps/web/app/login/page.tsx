import Link from 'next/link';
import LoginForm from './form';
import { authConfig } from '../../lib/supabase/config';
import { safeNext } from '../../lib/routes';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = !!authConfig() && !!process.env.SITE_URL;
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <img src="/brand/bidxchange-logo.png?v=2" alt="BidXchange" />
        <h1>Welcome to your contract desk.</h1>
        <p>Sign in with your email. No password needed.</p>
        {!configured && (
          <div className="info-note">
            Setup required: add SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SITE_URL to the server
            environment. The demo remains available.
          </div>
        )}
        {params.error && (
          <div role="alert" className="info-note">
            Sign-in could not be completed. The link may have expired or been opened in a different
            browser. Request a new link.
          </div>
        )}
        <LoginForm configured={configured} next={safeNext(params.next)} />
        <Link className="text-button" href="/dashboard?workspace=demo">
          Explore Apex Energy Demo →
        </Link>
        <p className="auth-footnote">
          Access is limited to provisioned accounts. Contact your organization administrator for
          membership.
        </p>
      </section>
    </main>
  );
}
