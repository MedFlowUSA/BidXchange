import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { accountContext } from '../../../../lib/tenant';
import AppShell from '../../../../components/app-shell';
import SourceInbox, { type InboxItem, type SavedSearch } from '../../../../components/source-inbox';
import type { RouteQuery } from '../../../../lib/route-view';
export default async function Page({ searchParams }: { searchParams: RouteQuery }) {
  const query = await searchParams;
  if (query.workspace || (query.organization && typeof query.organization !== 'string')) notFound();
  const account = await accountContext();
  if (!account.user || !account.supabase) redirect('/login?next=/opportunities');
  const org =
    typeof query.organization === 'string'
      ? query.organization
      : account.choices.length === 1
        ? account.choices[0].id
        : '';
  if (!z.uuid().safeParse(org).success || !account.choices.some((c) => c.id === org)) notFound();
  const enabled = process.env.BIDXCHANGE_SOURCES_ENABLED === 'true';
  const canEdit = account.choices.some(
    (c) => c.id === org && ['organization_admin', 'capture_manager'].includes(c.role),
  );
  const page = Math.floor(Math.min(10000, Math.max(0, Number(query.page) || 0)));
  const view =
    typeof query.view === 'string' &&
    ['new', 'needs_review', 'saved', 'converted', 'dismissed'].includes(query.view)
      ? query.view
      : 'all';
  let connection: {
    enabled: boolean;
    last_status: string;
    last_success: string | null;
    last_attempt: string | null;
  } | null = null;
  let items: InboxItem[] = [];
  let searches: SavedSearch[] = [];
  let members: { user_id: string }[] = [];
  if (enabled) {
    const db = account.supabase;
    let inboxQuery = db.from('source_inbox').select('*').eq('organization_id', org);
    if (view === 'needs_review')
      inboxQuery = inboxQuery.or('status.eq.needs_review,change_pending.eq.true');
    else if (view !== 'all') inboxQuery = inboxQuery.eq('status', view);
    const [inbox, saved, directory, status] = await Promise.all([
      inboxQuery
        .order('created_at', { ascending: false })
        .order('id')
        .range(page * 20, page * 20 + 19),
      db
        .from('opportunity_searches')
        .select('*')
        .eq('organization_id', org)
        .order('created_at')
        .limit(30),
      db
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', org)
        .eq('status', 'active')
        .limit(500),
      db.rpc('source_connection_status', { org }),
    ]);
    if (inbox.error || saved.error || directory.error || status.error)
      throw new Error('Source inbox unavailable. Check migration and access.');
    connection = status.data?.[0] ?? null;
    searches = saved.data as SavedSearch[];
    members = directory.data;
    items = await Promise.all(
      inbox.data.map(async (i) => {
        const [record, versions] = await Promise.all([
          db.from('source_records').select('*').eq('id', i.record_id).single(),
          db
            .from('source_record_versions')
            .select('id,prior_version_id,captured_at,normalized,changed_fields,severity')
            .eq('record_id', i.record_id)
            .order('captured_at', { ascending: false })
            .limit(10),
        ]);
        if (record.error || versions.error) throw new Error('Source history unavailable.');
        return { ...i, record: record.data, versions: versions.data } as InboxItem;
      }),
    );
  }
  return (
    <AppShell page="Opportunities" choices={account.choices} userEmail={account.user.email}>
      <main>
        <section className="panel">
          <Link href={`/opportunities?organization=${org}`}>← Opportunities</Link>
          <h1>Source inbox</h1>
          <p>
            Official notices, observed changes, and your next review. A search match is not an
            eligibility finding.
          </p>
          <p>
            SAM.gov coverage only. No state, county, city, utility or school-district feeds are
            connected.
          </p>
          {!connection?.enabled && (
            <p role="status">
              SAM.gov connection not configured or disabled. No live search is being performed.
            </p>
          )}
          {connection && (
            <p>
              Last attempt: {connection.last_attempt ?? 'Never'} · Last complete synchronization:{' '}
              {connection.last_success ?? 'Never'} · Run status: {connection.last_status}. This
              covers only the bounded date range and tracked-notice rechecks.
            </p>
          )}
        </section>
        {enabled ? (
          <>
            <SourceInbox
              key={`${org}-${view}-${page}`}
              org={org}
              items={items}
              searches={searches}
              canEdit={canEdit}
              members={members}
              asOf={new Date().toISOString()}
              serverFilter={view}
            />
            <nav aria-label="Source inbox pages">
              {page > 0 && (
                <Link href={`?organization=${org}&view=${view}&page=${page - 1}`}>
                  Previous page
                </Link>
              )}{' '}
              {items.length === 20 && (
                <Link href={`?organization=${org}&view=${view}&page=${page + 1}`}>Next page</Link>
              )}
            </nav>
            <p>
              20 records per page, with the latest 10 observed versions per record. Older versions
              remain retained for operator review.
            </p>
          </>
        ) : (
          <section className="panel">
            <h2>Source intake is not activated</h2>
            <p>
              Continue recording opportunities manually. Source intake requires its reviewed
              database migration and operator configuration.
            </p>
          </section>
        )}
      </main>
    </AppShell>
  );
}
