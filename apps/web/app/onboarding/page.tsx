import Link from 'next/link';
import { connection } from 'next/server';
import { randomUUID } from 'node:crypto';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { accountContext, loadTenant } from '../../lib/tenant';
import { workspaceHref } from '../../lib/routes';
import { californiaPassportSteps } from '../../lib/california-passport';
import { passportRecords } from '../../lib/passport-records';
import { CreateCompanyForm, AcceptInvitationForm } from '../../components/workspace-onboarding';
import type { IncomingInvitation } from '../../lib/workspace-onboarding';

export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  if (process.env.BIDXCHANGE_SELF_SERVICE_ENABLED !== 'true')
    return (
      <main className="auth-page">
        <section className="panel setup-card">
          <h1>Company setup</h1>
          <p>Company setup is not available yet. Contact your company administrator for access.</p>
          <Link href="/login">Sign in</Link>
        </section>
      </main>
    );
  const query = await searchParams;
  const account = await accountContext();
  if (!account.user || !account.supabase) redirect('/signup?next=%2Fonboarding');
  if (!account.user.email_confirmed_at)
    return (
      <main className="auth-page">
        <section className="panel setup-card">
          <h1>Confirm your email first</h1>
          <p>
            Use a fresh sign-in link or one-time email code before creating or joining a company.
          </p>
          <Link href="/login?next=%2Fonboarding">Confirm email</Link>
        </section>
      </main>
    );
  if (query.organization) {
    const id = z.uuid().safeParse(query.organization);
    if (!id.success || !account.choices.some((o) => o.id === id.data)) notFound();
    const { data } = await loadTenant(id.data, `/onboarding?organization=${id.data}`);
    if (!data) notFound();
    return (
      <main className="auth-page">
        <section className="panel setup-card">
          <div className="eyebrow">YOUR FIRST WORKSPACE</div>
          <p className="info-note">
            Human review required. BidXchange organizes contracting information but does not
            determine legal eligibility, set pricing, or submit bids.
          </p>
          <h1>{data.organization.operating_name}: start with your company evidence</h1>
          <p>
            Work through the Passport in one sitting or return when you have the records. No
            document uploads are required. Saving a record does not attest it or establish
            eligibility.
          </p>
          <ol>
            {californiaPassportSteps.map((step) => {
              const relatedCount = new Set(
                step.items.flatMap((item) =>
                  passportRecords(data.facts, item).map((fact) => fact.id),
                ),
              ).size;
              return (
                <li key={step.id}>
                  <h2>
                    <Link href={`${workspaceHref('/company', id.data)}#passport-${step.id}`}>
                      {step.question}
                    </Link>
                  </h2>
                  <p>{step.why}</p>
                  <p>
                    {relatedCount
                      ? `${relatedCount} related records saved — review scope, sources and missing fields. Presence does not mean this section is complete or attested.`
                      : 'No related records visible yet — add what you can support and leave unknowns blank.'}
                  </p>
                </li>
              );
            })}
          </ol>
          <h2>Then follow one opportunity</h2>
          <p>
            Review missing information and expirations in Company. Record the buyer’s notice, open a
            pursuit and review candidate requirements against your evidence.
          </p>
          <p>
            <Link className="button primary" href={workspaceHref('/opportunities', id.data)}>
              Record your first opportunity
            </Link>
          </p>
          {data.organization.role === 'organization_admin' && (
            <p>
              <Link href={workspaceHref('/settings/team', id.data)}>Invite your team</Link>
            </p>
          )}
          <p>
            <Link href="/onboarding">Your companies and invitations</Link>
          </p>
        </section>
      </main>
    );
  }
  const { data: invitations, error } = await account.supabase.rpc('my_company_invitations');
  return (
    <main className="auth-page">
      <section className="panel setup-card">
        <h1>Create or join a company</h1>
        <p className="info-note">
          Human review required. BidXchange organizes contracting information but does not determine
          legal eligibility, set pricing, or submit bids.
        </p>
        <p>Signed in as {account.user.email}. Each company has separate records and permissions.</p>
        <h2>Your companies</h2>
        {account.choices.length ? (
          <ul>
            {account.choices.map((o) => (
              <li key={o.id}>
                <Link href={workspaceHref('/dashboard', o.id)}>{o.operating_name}</Link> ·{' '}
                <Link href={`/onboarding?organization=${o.id}`}>Setup checklist</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            You do not have an active company workspace yet. Accept an invitation below or create a
            company you administer.
          </p>
        )}
        <h2>Invitations for your email</h2>
        {error ? (
          <p role="alert">
            Invitations could not be loaded. Refresh before creating a company if you expect an
            invitation.
          </p>
        ) : invitations?.length ? (
          (invitations as IncomingInvitation[]).map((i) => (
            <AcceptInvitationForm key={i.id} invitation={i} />
          ))
        ) : (
          <p>
            No current invitations match your confirmed email. If you expected one, ask the
            administrator to check the address and expiration.
          </p>
        )}
        <details open={!account.choices.length && !invitations?.length && !error}>
          <summary>Create a new company</summary>
          <p>
            If your company already uses BidXchange, ask its administrator for an invitation to
            avoid a separate workspace.
          </p>
          <CreateCompanyForm requestId={randomUUID()} />
        </details>
        <p>
          <Link href="/settings/security">Account security and sign-out options</Link>
        </p>
      </section>
    </main>
  );
}
