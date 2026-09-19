'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <section className="panel">
        <h1>Workspace unavailable</h1>
        <p>
          We could not load authorized workspace data. Check the Supabase configuration and
          migrations, or try again.
        </p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
