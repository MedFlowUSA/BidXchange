import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServer } from '../../lib/supabase/server';
import { operationsContact } from '../../lib/operations-contact';
import DemoRequestReview from '../../components/demo-request-review';

export const metadata: Metadata = {
  title: 'Operations | BidXchange',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function Operations({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const db = await createSupabaseServer();
  if (!db || !(await db.auth.getUser()).data.user) redirect('/login?next=%2Foperations');
  const operator = await db.rpc('is_demo_operator');
  if (operator.error || operator.data !== true) notFound();
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const status = params.status ?? 'new';
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000 ||
    !['new', 'contacted', 'qualified', 'closed'].includes(status)
  )
    notFound();
  const result = await db
    .from('demo_requests')
    .select('id,full_name,email,company,message,status,version,created_at', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  if (result.error) throw new Error('The demo request queue is temporarily unavailable.');
  return (
    <main className="content">
      <Link href="/dashboard">Back to workspaces</Link>
      <h1>Demo requests</h1>
      <p>
        Initial operations owner: {operationsContact.name} · {operationsContact.email}
      </p>
      <p>
        Review saved requests and respond from your business mailbox. Updating a status does not
        send email. Operator access here grants no access to company workspaces.
      </p>
      <nav aria-label="Request status">
        {['new', 'contacted', 'qualified', 'closed'].map((value) => (
          <Link
            key={value}
            href={`/operations?status=${value}`}
            aria-current={value === status ? 'page' : undefined}
            style={{ marginRight: 16 }}
          >
            {value}
          </Link>
        ))}
      </nav>
      {!result.data.length && <p>No requests in this view.</p>}
      {result.data.map((request) => (
        <article className="panel" key={request.id} style={{ padding: 24, marginTop: 16 }}>
          <h2>{request.company}</h2>
          <p>
            {request.full_name} ·{' '}
            <a href={`mailto:${encodeURIComponent(request.email)}`}>{request.email}</a>
          </p>
          <p>
            Received {new Date(request.created_at).toISOString()} · {request.status}
          </p>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{request.message}</p>
          <DemoRequestReview id={request.id} version={request.version} status={request.status} />
        </article>
      ))}
      <nav aria-label="Queue pages">
        {page > 1 && (
          <Link href={`/operations?status=${status}&page=${page - 1}`}>Previous page</Link>
        )}{' '}
        <span>Page {page}</span>{' '}
        {page * 25 < (result.count ?? 0) && (
          <Link href={`/operations?status=${status}&page=${page + 1}`}>Next page</Link>
        )}
      </nav>
    </main>
  );
}
