import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import Workspace from '../components/workspace';
import TenantWorkspace from '../components/tenant-workspace';
import AppShell from '../components/app-shell';
import { accountContext, loadTenant } from './tenant';
import { sections, workspaceHref } from './routes';
import { loadDecisionMemory } from './decision-memory-records';
export type RouteQuery = Promise<Record<string, string | string[] | undefined>>;
export async function renderWorkspace(
  page: string,
  searchParams: RouteQuery,
  recordId?: string,
  recordType?: 'opportunity' | 'pursuit',
) {
  const query = await searchParams;
  if (query.workspace && query.workspace !== 'demo') notFound();
  if (query.workspace === 'demo') {
    if (query.organization) notFound();
    if (recordId && !/^DEMO-[a-zA-Z0-9-]{1,50}$/.test(recordId)) notFound();
    const account = await accountContext();
    return (
      <Workspace
        key={`${page}-${recordId ?? ''}`}
        initialPage={page}
        recordId={recordId}
        recordType={recordType}
        choices={account.choices}
        userEmail={account.user?.email}
        demoAssistantEnabled={process.env.BIDXCHANGE_AI_DEMO_ENABLED === 'true'}
        liveDemoAssistant={process.env.BIDXCHANGE_AI_PUBLIC_DEMO_ENABLED === 'true'}
      />
    );
  }
  if (query.organization && typeof query.organization !== 'string') notFound();
  const path =
    (sections[page] ?? '/dashboard') + (recordId ? '/' + encodeURIComponent(recordId) : '');
  const next =
    path +
    (query.organization ? '?organization=' + encodeURIComponent(query.organization as string) : '');
  if (recordId && (!recordType || !z.uuid().safeParse(recordId).success)) notFound();
  const { account, data } = await loadTenant(
    query.organization as string | undefined,
    next,
    recordId && recordType ? { id: recordId, kind: recordType } : undefined,
  );
  if (!data)
    return (
      <AppShell page={page} choices={account.choices} userEmail={account.user?.email}>
        <main>
          <section className="panel">
            <h1>Choose your workspace</h1>
            {account.choices.length ? (
              account.choices.map((o) => (
                <p key={o.id}>
                  <Link href={workspaceHref('/dashboard', o.id)}>{o.operating_name} →</Link>
                </p>
              ))
            ) : (
              <div>
                <p>
                  You’re signed in, but your account does not have an active company workspace yet.
                  {process.env.BIDXCHANGE_SELF_SERVICE_ENABLED === 'true'
                    ? ' Create a company or accept an invitation to get started.'
                    : ` Ask your organization administrator to confirm access for ${account.user?.email}.`}
                </p>
                <p>
                  <a href="mailto:mrodriguez@oaisinc.com?subject=BidXchange%20workspace%20access">
                    Request workspace access help
                  </a>
                </p>
                <details>
                  <summary>Account reference for your administrator</summary>
                  <code>{account.user?.id}</code>
                </details>
              </div>
            )}
            {process.env.BIDXCHANGE_SELF_SERVICE_ENABLED === 'true' && (
              <p>
                <Link className="button primary" href="/onboarding">
                  Create or join a company
                </Link>
              </p>
            )}
            <Link href="/dashboard?workspace=demo">Explore the fictional demo →</Link>
          </section>
        </main>
      </AppShell>
    );
  data.decisionMemoryEnabled = process.env.BIDXCHANGE_DECISION_MEMORY_ENABLED === 'true';
  if (data.decisionMemoryEnabled && account.supabase && (page === 'Company' || recordId)) {
    const opportunityId =
      recordType === 'opportunity'
        ? recordId
        : recordType === 'pursuit'
          ? data.pursuits.find((p) => p.id === recordId)?.opportunity_id
          : undefined;
    const memoryPage = z.coerce
      .number()
      .int()
      .min(0)
      .max(1000)
      .safeParse(query.decision_page ?? 0);
    data.decisionMemory = await loadDecisionMemory(
      account.supabase,
      data.organization.id,
      opportunityId,
      memoryPage.success ? memoryPage.data : 0,
      typeof query.decision_query === 'string' ? query.decision_query : '',
    );
  }
  return (
    <TenantWorkspace
      key={data.organization.id}
      data={data}
      page={page}
      recordId={recordId}
      recordType={recordType}
    />
  );
}
