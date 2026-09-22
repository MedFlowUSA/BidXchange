import Link from 'next/link';
import LoginForm from '../login/form';
import { authConfig } from '../../lib/supabase/config';

export default function Signup() {
  const enabled = process.env.BIDXCHANGE_SELF_SERVICE_ENABLED === 'true';
  const configured = enabled && !!authConfig() && !!process.env.SITE_URL;
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <img src="/brand/bidxchange-logo.png?v=2" alt="BidXchange" />
        <h1>Set up your contractor workspace</h1>
        <p>
          Confirm your work email, then create a company or accept an invitation. Your company’s
          records stay separate from other workspaces.
        </p>
        {!configured && (
          <p className="info-note">
            New account setup is not available yet. Existing members can still sign in.
          </p>
        )}
        <LoginForm configured={configured} signup next="/onboarding" />
        <p>
          Already have an account?{' '}
          <Link href="/login?next=%2Fonboarding">Sign in to create or join a company</Link>.
        </p>
        <p>
          Invited by a colleague? Use the exact invited email address. An invitation never gives
          another company access to your records.
        </p>
        <nav aria-label="Legal documents">
          <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Use</Link>
        </nav>
        <p>
          Human review required. BidXchange organizes contracting information but does not determine
          legal eligibility, set pricing or submit bids.
        </p>
      </section>
    </main>
  );
}
