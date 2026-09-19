import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import Workspace from '../components/workspace';
import TenantWorkspace from '../components/tenant-workspace';
import AppShell from '../components/app-shell';
import { accountContext, loadTenant } from './tenant';
import { sections, workspaceHref } from './routes';
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
      />
    );
  }
  if (query.organization && typeof query.organization !== 'string') notFound();
  const path =
    (sections[page] ?? '/dashboard') + (recordId ? '/' + encodeURIComponent(recordId) : '');
  const next =
    path +
    (query.organization ? '?organization=' + encodeURIComponent(query.organization as string) : '');
  const { account, data } = await loadTenant(query.organization as string | undefined, next);
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
              <p>
                No active organization membership. Ask the administrator to assign your
                authenticated user ID: <code>{account.user?.id}</code>. Access is never assigned
                automatically.
              </p>
            )}
            <Link href="/dashboard?workspace=demo">Explore the fictional demo →</Link>
          </section>
        </main>
      </AppShell>
    );
  if (recordId) {
    if (!z.uuid().safeParse(recordId).success) notFound();
    const records = recordType === 'pursuit' ? data.pursuits : data.opportunities;
    if (!records.some((r) => r.id === recordId)) notFound();
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
