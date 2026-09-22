import Link from 'next/link';
import { connection } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { accountContext } from '../../../../lib/tenant';
import { workspaceHref } from '../../../../lib/routes';
import {
  InviteMemberForm,
  RevokeInvitationForm,
} from '../../../../components/workspace-onboarding';
import { roleLabel, type ManagedInvitation } from '../../../../lib/workspace-onboarding';
import { loadManagedInvitations } from '../../../../lib/onboarding-records';

export default async function Team({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  if (process.env.BIDXCHANGE_SELF_SERVICE_ENABLED !== 'true') notFound();
  const query = await searchParams;
  const id = z.uuid().safeParse(query.organization);
  if (!id.success) notFound();
  const account = await accountContext();
  if (!account.user || !account.supabase)
    redirect('/login?next=' + encodeURIComponent(workspaceHref('/settings/team', id.data)));
  const org = account.choices.find((o) => o.id === id.data && o.role === 'organization_admin');
  if (!org) notFound();
  const { data, error, reviewedAt } = await loadManagedInvitations(account.supabase, org.id);
  const site = process.env.SITE_URL;
  return (
    <main className="auth-page">
      <section className="panel setup-card">
        <h1>Team invitations · {org.operating_name}</h1>
        <p className="info-note">
          Human review required. BidXchange organizes contracting information but does not determine
          legal eligibility, set pricing, or submit bids.
        </p>
        <p>
          Invite colleagues to this company only. Creating an invitation does not give access until
          the named person confirms their email and accepts.
        </p>
        {site ? (
          <InviteMemberForm
            organizationId={org.id}
            joinUrl={`${site.replace(/\/$/, '')}/onboarding`}
          />
        ) : (
          <p role="alert">
            The public site address is not configured. Invitations are unavailable.
          </p>
        )}
        <h2>Recent invitations</h2>
        {error ? (
          <p role="alert">Invitations could not be loaded. Please retry.</p>
        ) : data?.length ? (
          <ul>
            {(data as ManagedInvitation[]).map((i) => (
              <li key={i.id}>
                <p>
                  {i.email} · {roleLabel(i.role)} ·{' '}
                  {i.status === 'pending' && Date.parse(i.expires_at) <= Date.parse(reviewedAt)
                    ? 'expired'
                    : i.status}{' '}
                  · expires {i.expires_at.slice(0, 10)} (UTC)
                </p>
                {i.status === 'pending' && (
                  <RevokeInvitationForm organizationId={org.id} invitation={i} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No invitations yet. Choose a colleague’s email and role above to invite them.</p>
        )}
        <Link href={workspaceHref('/settings', org.id)}>Back to company settings</Link>
      </section>
    </main>
  );
}
