'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <section className="panel">
        <h1>Workspace unavailable</h1>
        <p>
          We could not load your workspace. Try again shortly. If you were saving work, check the
          record after reconnecting before repeating the change.
        </p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
        <p>
          <a href="/login">Return to sign-in</a> ·{' '}
          <a href="mailto:mrodriguez@oaisinc.com?subject=BidXchange%20workspace%20help">
            Contact support
          </a>
        </p>
      </section>
    </main>
  );
}
