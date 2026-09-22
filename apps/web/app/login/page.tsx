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
            Sign-in is temporarily unavailable. Please contact your organization administrator. You
            can still explore the demo below.
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
          New to BidXchange? Your organization administrator needs to arrange access before you can
          sign in. Use the email address they registered for you.
        </p>
        <details className="code-signin">
          <summary>Need help signing in?</summary>
          <p>
            Check spam or junk folders and use the newest email. Open the link in the same browser
            where you requested it, or enter the one-time code if the email includes one.
          </p>
          <p>
            If your link has expired, request a new email. If you can sign in but cannot see your
            company, ask your administrator to confirm your workspace membership.
          </p>
          <a href="mailto:mrodriguez@oaisinc.com?subject=BidXchange%20access%20help">
            Contact BidXchange for access help
          </a>
          <p>
            Include your company name and a description of the issue. Never send sign-in links,
            one-time codes or passwords.
          </p>
        </details>
        <nav aria-label="Legal documents">
          <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Use</Link>
          <p className="auth-footnote">Drafts for review — not yet effective.</p>
        </nav>
      </section>
    </main>
  );
}
