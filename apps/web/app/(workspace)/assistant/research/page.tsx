import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { accountContext } from '../../../../lib/tenant';
import type { RouteQuery } from '../../../../lib/route-view';
import AppShell from '../../../../components/app-shell';
import OpportunityResearch from '../../../../components/opportunity-research';
export default async function Page({ searchParams }: { searchParams: RouteQuery }) {
  const query = await searchParams;
  if (query.workspace || (query.organization && typeof query.organization !== 'string')) notFound();
  const account = await accountContext();
  if (!account.user) redirect('/login?next=/assistant/research');
  const org = query.organization
    ? account.choices.find((o) => o.id === query.organization)
    : account.choices.length === 1
      ? account.choices[0]
      : null;
  if (query.organization && !org) notFound();
  if (!org)
    return (
      <main>
        <h1>Choose an organization</h1>
        <Link href="/assistant">Open BidBuddy</Link>
      </main>
    );
  const available = await account
    .supabase!.from('opportunities')
    .select('id')
    .eq('organization_id', org.id)
    .limit(1);
  if (available.error)
    throw new Error('Workspace opportunity status is unavailable. Retry shortly.');
  return (
    <AppShell
      page="Assistant"
      organization={org}
      choices={account.choices}
      userEmail={account.user.email}
    >
      <main>
        <OpportunityResearch
          key={org.id}
          org={org.id}
          name={org.operating_name}
          hasOpportunities={Boolean(available.data?.length)}
        />
      </main>
    </AppShell>
  );
}
