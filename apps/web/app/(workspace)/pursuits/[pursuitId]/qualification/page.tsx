import { notFound } from 'next/navigation';
import { z } from 'zod';
import Link from 'next/link';
import AppShell from '../../../../../components/app-shell';
import QualificationWorkspace from '../../../../../components/qualification-workspace';
import { loadTenant } from '../../../../../lib/tenant';
import type { RouteQuery } from '../../../../../lib/route-view';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ pursuitId: string }>;
  searchParams: RouteQuery;
}) {
  const { pursuitId } = await params;
  const query = await searchParams;
  if (
    !z.uuid().safeParse(pursuitId).success ||
    query.workspace ||
    (query.organization && typeof query.organization !== 'string')
  )
    notFound();
  const { account, data } = await loadTenant(
    query.organization as string | undefined,
    `/pursuits/${pursuitId}/qualification`,
    { kind: 'pursuit', id: pursuitId },
  );
  if (!data)
    return (
      <main>
        <h1>Choose an organization</h1>
        <Link href="/pursuits">Open workspace selection</Link>
      </main>
    );
  return (
    <AppShell
      page="Pursuits"
      organization={data.organization}
      choices={account.choices}
      userEmail={account.user?.email}
    >
      <main>
        <QualificationWorkspace data={data} pursuitId={pursuitId} />
      </main>
    </AppShell>
  );
}
