import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <h1>Record not found or access denied.</h1>
        <p>
          The requested record is unavailable in this workspace. You have not been switched to
          another organization.
        </p>
        <Link className="button primary" href="/dashboard">
          Choose an authorized workspace
        </Link>
        <Link className="text-button" href="/pursuits/DEMO-001?workspace=demo">
          Open the fictional demo
        </Link>
      </section>
    </main>
  );
}
