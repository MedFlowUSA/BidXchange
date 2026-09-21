import Link from 'next/link';
import { loadTenant } from '../../../../lib/tenant';
import type { RouteQuery } from '../../../../lib/route-view';
import SourceRegistry from '../../../../components/source-registry';
import AppShell from '../../../../components/app-shell';
import { notFound } from 'next/navigation';
import type { SourceRegistration } from '../../../../lib/sources/normalized';
export default async function Page({ searchParams }: { searchParams: RouteQuery }) {
  const query = await searchParams;
  if (query.workspace || (query.organization && typeof query.organization !== 'string')) notFound();
  const { account, data } = await loadTenant(
    query.organization as string | undefined,
    '/opportunities/registry',
  );
  if (!data)
    return (
      <main>
        <h1>Choose an organization</h1>
        <Link href="/opportunities">Open workspace selection</Link>
      </main>
    );
  const org = data.organization.id;
  const [registrations, counts, sam] = await Promise.all([
    account
      .supabase!.from('source_registrations')
      .select('*')
      .eq('organization_id', org)
      .order('source_id')
      .limit(100),
    account.supabase!.rpc('source_registry_counts', { org }),
    process.env.BIDXCHANGE_SOURCES_ENABLED === 'true'
      ? account.supabase!.rpc('source_connection_status', { org })
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (registrations.error || counts.error || sam.error)
    throw new Error('Source registry unavailable. Retry or contact the administrator.');
  return (
    <AppShell
      page="Opportunities"
      organization={data.organization}
      choices={account.choices}
      userEmail={account.user?.email}
    >
      <main>
        <Link href={`/opportunities?organization=${org}`}>Back to opportunities</Link>
        <SourceRegistry
          org={org}
          admin={data.organization.role === 'organization_admin'}
          canEdit={['organization_admin', 'capture_manager'].includes(data.organization.role)}
          registrations={registrations.data as SourceRegistration[]}
          counts={Object.fromEntries(
            (counts.data ?? []).map((r: { source_id: string; active_count: number }) => [
              r.source_id,
              Number(r.active_count),
            ]),
          )}
          sam={sam.data?.[0] ?? null}
        />
      </main>
    </AppShell>
  );
}
