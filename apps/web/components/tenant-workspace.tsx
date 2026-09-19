'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import AppShell from './app-shell';
import AiPreview from './ai-preview';
import PursuitFoundation from './pursuit-foundation';
import { workspaceHref } from '../lib/routes';
import type { TenantData, Fact } from '../lib/tenant-types';
import {
  updateOrganization,
  updateFact,
  updateMembership,
  type MutationState,
} from '../app/actions';

function ActionForm({
  action,
  children,
  label,
}: {
  action: (state: MutationState, form: FormData) => Promise<MutationState>;
  children: React.ReactNode;
  label: string;
}) {
  const [state, submit, pending] = useActionState(action, { message: '' });
  return (
    <form action={submit} className="opportunity-form admin-form">
      {children}
      <button className="button primary" disabled={pending}>
        {pending ? 'Saving…' : label}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
function FactCard({ fact, admin, org }: { fact: Fact; admin: boolean; org: string }) {
  const verified = ['verified', 'expiring'].includes(fact.verification_status);
  return (
    <section className="panel fact-card">
      <div className="flex-between">
        <h3>{fact.label}</h3>
        <span className={`fit ${verified ? 'green' : 'amber'}`}>
          {fact.verification_status.replaceAll('_', ' ')}
        </span>
      </div>
      <strong>{fact.value ?? 'Not provided'}</strong>
      <p>{fact.source_note}</p>
      <div className="fact-source">
        Evidence: {fact.source_reference || 'Not provided'}
        {fact.verified_at && (
          <p>
            Human verification: {new Date(fact.verified_at).toLocaleDateString()} ·{' '}
            {fact.verified_by}
          </p>
        )}
        {fact.expiration_date && <p>Expires: {fact.expiration_date}</p>}
      </div>
      {admin && (
        <details>
          <summary>Review verification</summary>
          <ActionForm action={updateFact} label="Save fact review">
            <input type="hidden" name="organization_id" value={org} />
            <input type="hidden" name="fact_id" value={fact.id} />
            <input type="hidden" name="updated_at" value={fact.updated_at} />
            <label>
              Evidence reference
              <input
                name="source_reference"
                maxLength={2000}
                defaultValue={fact.source_reference ?? ''}
              />
            </label>
            <label>
              Verification status
              <select name="verification_status" defaultValue={fact.verification_status}>
                {[
                  'unverified',
                  'pending_verification',
                  'verified',
                  'expiring',
                  'expired',
                  'rejected',
                ].map((s) => (
                  <option value={s} key={s}>
                    {s.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Save a new evidence reference as pending first. Then verify only after reviewing an
              authorized current source.
            </p>
          </ActionForm>
        </details>
      )}
    </section>
  );
}
export default function TenantWorkspace({
  data,
  page,
  recordId,
  recordType,
}: {
  data: TenantData;
  page: string;
  recordId?: string;
  recordType?: 'opportunity' | 'pursuit';
}) {
  const { organization: org } = data;
  const admin = org.role === 'organization_admin';
  const href = (path: string) => workspaceHref(path, org.id);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const pursuit =
    recordType === 'pursuit' ? data.pursuits.find((p) => p.id === recordId) : undefined;
  const opportunity = data.opportunities.find(
    (o) => o.id === (pursuit?.opportunity_id ?? recordId),
  );
  const records = [
    ...data.opportunities.map((o) => ({
      title: o.title,
      category: 'Opportunity',
      text: `${o.solicitation_number ?? ''} ${o.buyer ?? ''}`,
      href: href('/opportunities/' + o.id),
    })),
    ...data.pursuits.map((p) => ({
      title: p.title,
      category: 'Pursuit',
      href: href('/pursuits/' + p.id),
    })),
    ...data.documents.map((d) => ({
      title: d.title,
      category: 'Document',
      href: href('/documents'),
    })),
    ...data.facts.map((f) => ({
      title: f.label,
      category: 'Company fact',
      text: f.value ?? '',
      href: href('/company'),
    })),
  ];
  const pending = data.facts.filter(
    (f) => !['verified', 'expiring'].includes(f.verification_status),
  );
  const download = () => {
    const text = [
      `${org.operating_name} — opportunity brief`,
      `Generated ${new Date().toISOString()}`,
      `${data.opportunities.length} recorded opportunities. No live feeds connected.`,
      ...data.opportunities.map(
        (o) =>
          `${o.title}\n${o.buyer ?? 'Buyer not provided'}\nDeadline: ${o.official_deadline ?? 'Not provided'} (${o.deadline_timezone})\nSource: ${o.source_url ?? 'Not provided'}`,
      ),
      'Opportunity estimates are not awards or collected revenue.',
    ].join('\n\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${org.slug}-brief.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setNotice('Brief download started.');
  };
  const deadline = opportunity?.official_deadline
    ? new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: opportunity.deadline_timezone,
      }).format(new Date(opportunity.official_deadline))
    : 'Not provided';
  return (
    <AppShell
      page={page}
      organization={org}
      choices={data.choices}
      userEmail={data.userEmail}
      records={records}
    >
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              {org.operating_name.toUpperCase()} · {org.status.toUpperCase()}
            </div>
            <h1>
              {recordId
                ? (pursuit?.title ?? opportunity?.title)
                : page === 'Today'
                  ? 'Your workspace starts with the facts.'
                  : page}
            </h1>
            <p>
              {recordId
                ? 'A dedicated, organization-scoped record.'
                : 'Authenticated organization data. Working facts require human verification.'}
            </p>
          </div>
          {!recordId && (page === 'Reports' || page === 'Today') && (
            <button className="button secondary" onClick={download}>
              Export brief
            </button>
          )}
        </div>
        {notice && (
          <div className="info-note" role="status">
            {notice}
          </div>
        )}
        {recordId && opportunity ? (
          recordType === 'pursuit' ? (
            <>
              <PursuitFoundation
                source={opportunity.source_url ?? opportunity.source_note ?? 'Not provided'}
                deadline={deadline}
                timezone={opportunity.deadline_timezone}
                opportunityHref={href('/opportunities/' + opportunity.id)}
              >
                <section className="panel">
                  <h2>Tasks</h2>
                  {data.tasks
                    .filter((t) => t.pursuit_id === recordId)
                    .map((t) => (
                      <p key={t.id}>
                        {t.title} · {t.status}
                      </p>
                    ))}
                  {!data.tasks.some((t) => t.pursuit_id === recordId) && (
                    <p>
                      No tasks assigned yet. Task editing is coming in the pursuit workflow phase.
                    </p>
                  )}
                </section>
              </PursuitFoundation>
            </>
          ) : (
            <section className="panel record-page">
              <Link href={href('/opportunities')}>← Back to opportunities</Link>
              <h2>Scope</h2>
              <p>{opportunity.summary ?? 'Not provided'}</p>
              <h3>Buyer</h3>
              <p>{opportunity.buyer ?? 'Not provided'}</p>
              <h3>Solicitation number</h3>
              <p>{opportunity.solicitation_number ?? 'Not provided'}</p>
              <h3>Official deadline</h3>
              <p>
                {deadline} · {opportunity.deadline_timezone}
              </p>
              <h3>Source</h3>
              <p>{opportunity.source_url ?? opportunity.source_note ?? 'Not provided'}</p>
              <div className="info-note">
                Qualification has not been performed. No eligibility or bid recommendation is
                implied.
              </div>
              {data.pursuits
                .filter((p) => p.opportunity_id === opportunity.id)
                .map((p) => (
                  <Link key={p.id} href={href('/pursuits/' + p.id)}>
                    Open pursuit: {p.title} →
                  </Link>
                ))}
            </section>
          )
        ) : null}
        {!recordId && page === 'Today' && (
          <>
            <div className="stats-grid">
              {[
                ['Recorded opportunities', data.opportunities.length],
                ['Pursuits', data.pursuits.length],
                ['Facts awaiting review', pending.length],
                [
                  'Needs information',
                  data.onboarding.filter((i) => i.status === 'needs_information').length,
                ],
              ].map(([label, n]) => (
                <div className="stat-card" key={label}>
                  <div>{label}</div>
                  <strong>{n}</strong>
                  <small>Current organization records</small>
                </div>
              ))}
            </div>
            <div className="report-grid">
              <section className="panel">
                <h2>Complete company readiness</h2>
                <p>
                  Start with current licensing, registrations, insurance, bonding, and named
                  approval authority.
                </p>
                <Link className="button primary" href={href('/company')}>
                  Review company facts
                </Link>
              </section>
              <section className="panel">
                <h2>A clean pursuit pipeline</h2>
                <p>
                  {data.opportunities.length === 0
                    ? 'No opportunities have been entered for this organization. Demo records have not been imported.'
                    : `${data.opportunities.length} opportunities recorded.`}
                </p>
                <Link className="text-button" href={href('/opportunities')}>
                  Open opportunity inbox →
                </Link>
              </section>
            </div>
            <AiPreview />
          </>
        )}
        {!recordId && page === 'Company' && (
          <>
            <div className="company-hero">
              <span className="large-avatar">GE</span>
              <div>
                <div className="eyebrow">COMPANY READINESS</div>
                <h2>{org.operating_name}</h2>
                <p>{org.legal_name}</p>
              </div>
              <span className="fit amber">{pending.length} facts need verification</span>
            </div>
            <div className="info-note">
              Pending facts are working research, not approved proposal evidence. CSLB and SAM
              status are not assumed active. Unknown values remain unfilled.
            </div>
            <div className="company-grid">
              {data.facts.map((f) => (
                <FactCard fact={f} org={org.id} admin={admin} key={`${f.id}-${f.updated_at}`} />
              ))}
            </div>
            <section className="panel">
              <h2>Needs information from GES</h2>
              <p>Confirm these with Donn or an authorized company representative.</p>
              <div className="onboarding-grid">
                {data.onboarding.map((i) => (
                  <div key={i.id}>
                    <span>{i.label}</span>
                    <span className="fit amber">
                      {i.status === 'needs_information'
                        ? 'Needs information'
                        : i.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {!recordId && page === 'Opportunities' && (
          <>
            <label className="search-field">
              <input
                aria-label="Search opportunities"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, buyer, solicitation…"
              />
            </label>
            <div className="opportunity-grid inbox-grid">
              {data.opportunities
                .filter((o) =>
                  `${o.title} ${o.buyer ?? ''} ${o.solicitation_number ?? ''}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((o) => (
                  <Link
                    className="opportunity-card"
                    key={o.id}
                    href={href('/opportunities/' + o.id)}
                  >
                    <span className="fit amber">Not qualified</span>
                    <h3>{o.title}</h3>
                    <p>{o.buyer ?? 'Buyer not provided'}</p>
                    <small>{o.solicitation_number ?? 'Solicitation number not provided'}</small>
                  </Link>
                ))}
            </div>
            {!data.opportunities.length && (
              <div className="panel empty-state">
                <h2>No opportunities yet</h2>
                <p>
                  No fictional notices were imported. Secure live intake is the next workflow phase.
                </p>
              </div>
            )}
          </>
        )}
        {!recordId && page === 'Pursuits' && (
          <div className="opportunity-grid">
            {data.pursuits.map((p) => (
              <Link key={p.id} className="pursuit-card" href={href('/pursuits/' + p.id)}>
                <h3>{p.title}</h3>
                <p>
                  {p.status} · Decision: {p.decision}
                </p>
              </Link>
            ))}
            {!data.pursuits.length && (
              <div className="panel empty-state">
                <h2>No pursuits yet</h2>
                <p>
                  GES starts with an empty pipeline. No bid decisions or awards have been assumed.
                </p>
              </div>
            )}
          </div>
        )}
        {!recordId && page === 'Documents' && (
          <section className="panel">
            <h2>Private company library</h2>
            <p>
              Uploads are not enabled until document validation and scanning are connected. No
              public file storage is used.
            </p>
            {data.documents.map((d) => (
              <p key={d.id}>
                {d.title} · {d.scan_status}
              </p>
            ))}
            {!data.documents.length && (
              <div className="empty-state">No documents available to your role.</div>
            )}
            <button className="button secondary" disabled>
              Secure upload coming in a later phase
            </button>
          </section>
        )}
        {!recordId && page === 'Reports' && (
          <>
            <div className="report-grid">
              <section className="panel">
                <h2>Recorded pipeline</h2>
                <p>
                  {data.opportunities.length} opportunities · {data.pursuits.length} pursuits
                </p>
                <p>
                  No live connectors. These counts reflect only records entered into this
                  organization.
                </p>
              </section>
              <section className="panel">
                <h2>Financial measures</h2>
                <p>
                  Awards, collected revenue, and BidXchange fees have not been recorded. Missing
                  values are not represented as zero-dollar results.
                </p>
              </section>
            </div>
            <section className="panel activity-panel">
              <h2>Organization activity</h2>
              {data.audit.map((a) => (
                <div className="activity-row" key={a.id}>
                  {new Date(a.created_at).toLocaleString()} · {a.action} · {a.entity_table}
                </div>
              ))}
              {!data.audit.length && (
                <p>
                  Audit history is restricted to organization administrators and executive
                  approvers.
                </p>
              )}
            </section>
          </>
        )}
        {!recordId && page === 'Settings' && (
          <>
            <div className="info-note">
              Signed in as {data.userEmail}. Your role: {org.role.replaceAll('_', ' ')}.
            </div>
            <section className="panel">
              <h2>Organization profile</h2>
              {admin ? (
                <ActionForm action={updateOrganization} label="Save organization">
                  <input type="hidden" name="organization_id" value={org.id} />
                  <label>
                    Operating name
                    <input
                      name="operating_name"
                      defaultValue={org.operating_name}
                      required
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Legal name
                    <input
                      name="legal_name"
                      defaultValue={org.legal_name}
                      required
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Website
                    <input name="website" type="url" defaultValue={org.website ?? ''} />
                  </label>
                  <label>
                    Default timezone
                    <input name="default_timezone" defaultValue={org.default_timezone} required />
                  </label>
                  <p>
                    Workspace identity fields are not verified company evidence. Review the
                    corresponding company facts separately.
                  </p>
                </ActionForm>
              ) : (
                <p>
                  {org.operating_name} · {org.default_timezone}. Organization changes require an
                  administrator.
                </p>
              )}
            </section>
            <section className="panel settings-panel">
              <h2>Users and roles</h2>
              {data.members.map((m) => (
                <div className="member-row" key={m.id}>
                  <p>
                    {m.user_id === data.userId ? 'You' : m.user_id} · {m.status}
                  </p>
                  {admin ? (
                    <ActionForm action={updateMembership} label="Update role">
                      <input type="hidden" name="organization_id" value={org.id} />
                      <input type="hidden" name="membership_id" value={m.id} />
                      <label>
                        Role
                        <select name="role" defaultValue={m.role}>
                          {[
                            'organization_admin',
                            'executive_approver',
                            'capture_manager',
                            'estimator',
                            'contributor',
                            'viewer',
                          ].map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </label>
                    </ActionForm>
                  ) : (
                    <p>{m.role.replaceAll('_', ' ')}</p>
                  )}
                </div>
              ))}
              <h3>Invitations</h3>
              <p>
                Donn’s login has not been created. His exact email and an administrator-approved
                role are required. Invitation sending will be enabled in a later phase.
              </p>
              <button className="button secondary" disabled>
                Invite user — not enabled yet
              </button>
            </section>
            <div className="company-grid settings-panel">
              {['Qualification settings', 'Notification settings', 'Audit/history access'].map(
                (t) => (
                  <section className="panel" key={t}>
                    <h3>{t}</h3>
                    <p>
                      {t === 'Audit/history access'
                        ? 'Administrators and executive approvers can view recent activity in Reports. Full audit export is planned.'
                        : 'Configuration controls are coming in a later phase.'}
                    </p>
                    {t === 'Audit/history access' && (
                      <Link href={href('/reports')}>View available activity →</Link>
                    )}
                  </section>
                ),
              )}
              <section className="panel">
                <h3>Procurement-source preferences</h3>
                <p>Preferences only. No live feeds or active registrations are implied.</p>
                {data.sources.map((s) => (
                  <p key={s.id}>{s.name} · Not connected</p>
                ))}
              </section>
            </div>
          </>
        )}
        <footer>
          <span>BidXchange · We Find. We Qualify. You Win.</span>
          <span>{org.operating_name}</span>
        </footer>
      </main>
    </AppShell>
  );
}
