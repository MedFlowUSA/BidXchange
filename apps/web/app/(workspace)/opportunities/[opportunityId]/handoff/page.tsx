import { notFound } from 'next/navigation';
import { z } from 'zod';
import Link from 'next/link';
import { loadTenant } from '../../../../../lib/tenant';
import type { RouteQuery } from '../../../../../lib/route-view';
import SourceDetails from '../../../../../components/source-details';
import AppShell from '../../../../../components/app-shell';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ opportunityId: string }>;
  searchParams: RouteQuery;
}) {
  const { opportunityId } = await params;
  const query = await searchParams;
  if (
    !z.uuid().safeParse(opportunityId).success ||
    query.workspace ||
    (query.organization && typeof query.organization !== 'string')
  )
    notFound();
  const { account, data } = await loadTenant(
    query.organization as string | undefined,
    `/opportunities/${opportunityId}/handoff`,
    { id: opportunityId, kind: 'opportunity' },
  );
  const opportunity = data?.opportunities.find((o) => o.id === opportunityId);
  if (!data || !opportunity) notFound();
  return (
    <AppShell
      page="Opportunities"
      organization={data.organization}
      choices={account.choices}
      userEmail={account.user?.email}
    >
      <main>
        <h1>Submission handoff</h1>
        <Link href={`/opportunities/${opportunityId}?organization=${data.organization.id}`}>
          Back to opportunity
        </Link>
        {opportunity.source_details ? (
          <SourceDetails data={data} opportunity={opportunity} handoff />
        ) : (
          <p>
            This legacy record has no normalized destination. Review the source and use its
            pursuit’s submission checklist.
          </p>
        )}
      </main>
    </AppShell>
  );
}
