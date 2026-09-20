'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import AppShell from './app-shell';
import Assistant from './assistant';
import AssistantUsage from './assistant-usage';
import { displayDate } from '../lib/ai/policy';
import PursuitFoundation from './pursuit-foundation';
import CompanyRecordForm from './company-record-form';
import CompanyPassport from './company-passport';
import { OpportunityForm, StartPursuitForm, TaskForm, RequirementForm } from './capture-forms';
import { requirementStatuses } from '../lib/capture-input';
import { workspaceHref } from '../lib/routes';
import type { TenantData, Fact } from '../lib/tenant-types';
import { companyReadiness, reviewStatus } from '../lib/company-readiness';
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
function FactCard({
  fact,
  admin,
  org,
  asOf,
  members,
  userId,
}: {
  fact: Fact;
  admin: boolean;
  org: string;
  asOf: string;
  members: TenantData['members'];
  userId: string;
}) {
  const status = reviewStatus(fact, asOf);
  const verified = status === 'reviewed';
  return (
    <section className="panel fact-card" id={`fact-${fact.id}`}>
      <div className="flex-between">
        <h3>{fact.label}</h3>
        <span className={`fit ${verified ? 'green' : 'amber'}`}>
          {status === 'reviewed' ? 'Evidence reviewed' : status.replaceAll('_', ' ')}
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
        {fact.effective_date && <p>Effective: {fact.effective_date}</p>}
        {fact.owner_user_id && (
          <p>Record owner: {fact.owner_user_id === userId ? 'You' : fact.owner_user_id}</p>
        )}
        {fact.sensitivity && (
          <p>
            Visibility: {fact.sensitivity === 'workspace' ? 'Company members' : 'Restricted review'}
          </p>
        )}
      </div>
      {admin && (
        <CompanyRecordForm
          organizationId={org}
          types={[fact.fact_type]}
          members={members}
          userId={userId}
          fact={fact}
        />
      )}
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
  const capture = admin || org.role === 'capture_manager';
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
  const readiness = companyReadiness(data.facts, data.reviewAsOf);
  const pending = readiness.needingReview;
  const nextFact = pending[0];
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
  const deadline = displayDate(opportunity?.official_deadline, opportunity?.deadline_timezone);
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
                <section className="panel" aria-labelledby="requirements-heading">
                  <h2 id="requirements-heading">Requirements and gaps</h2>
                  <p>
                    Capture the notice requirements and assign the next review. This register does
                    not verify compliance or determine eligibility.
                  </p>
                  <Link href={href('/company')}>Review company evidence</Link>
                  {!(data.requirements ?? []).length && (
                    <p>
                      No requirements recorded for this pursuit yet. This does not mean the notice
                      has no requirements.
                    </p>
                  )}
                  {(data.requirements ?? []).length > 500 && (
                    <p role="status">
                      Showing the first 500 requirements. This is a partial register; additional
                      records are not shown.
                    </p>
                  )}
                  {(data.requirements ?? []).slice(0, 500).map((requirement) => (
                    <article
                      className="panel"
                      key={requirement.id}
                      id={`requirement-${requirement.id}`}
                    >
                      <h3>{requirement.requirement}</h3>
                      <p>
                        Notice citation:{' '}
                        {requirement.citation || 'Not recorded; source review needed'}
                      </p>
                      <p>
                        Follow-up:{' '}
                        {Object.hasOwn(requirementStatuses, requirement.status)
                          ? requirementStatuses[
                              requirement.status as keyof typeof requirementStatuses
                            ]
                          : 'Needs review'}
                      </p>
                      <p>
                        Owner:{' '}
                        {requirement.owner_user_id === data.userId
                          ? 'You'
                          : (requirement.owner_user_id ?? 'Unassigned')}
                      </p>
                      {capture && (
                        <RequirementForm
                          data={data}
                          pursuitId={recordId}
                          requirement={requirement}
                        />
                      )}
                    </article>
                  ))}
                  {capture && <RequirementForm data={data} pursuitId={recordId} />}
                </section>
                <section className="panel">
                  <h2>Tasks</h2>
                  {data.tasks
                    .filter((t) => t.pursuit_id === recordId)
                    .map((t) => (
                      <div className="panel" key={t.id}>
                        <h3>{t.title}</h3>
                        <p>
                          {t.status.replaceAll('_', ' ')} · Owner:{' '}
                          {t.assigned_user_id === data.userId
                            ? 'You'
                            : (t.assigned_user_id ?? 'Unassigned')}
                        </p>
                        <p>Due: {displayDate(t.due_at, t.due_timezone ?? org.default_timezone)}</p>
                        {capture && <TaskForm data={data} pursuitId={recordId} task={t} />}
                      </div>
                    ))}
                  {!data.tasks.some((t) => t.pursuit_id === recordId) && (
                    <p>No tasks assigned yet. Add the next action with an owner and deadline.</p>
                  )}
                  {capture && <TaskForm data={data} pursuitId={recordId} />}
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
              {capture && <OpportunityForm data={data} opportunity={opportunity} />}
              {capture && !data.pursuits.some((p) => p.opportunity_id === opportunity.id) && (
                <StartPursuitForm organizationId={org.id} opportunityId={opportunity.id} />
              )}
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
            <section className="panel" aria-labelledby="readiness-next-action">
              <div className="eyebrow">YOUR NEXT STEP</div>
              <h2 id="readiness-next-action">
                {nextFact ? `Review ${nextFact.label}` : 'Review your company readiness'}
              </h2>
              <p>
                {nextFact
                  ? `This visible record is ${reviewStatus(nextFact, data.reviewAsOf).replaceAll('_', ' ')}. Confirm current evidence before relying on it in a response.`
                  : 'Confirm company basics, capabilities and current evidence with an authorized representative before evaluating an opportunity.'}
              </p>
              <p>
                {admin
                  ? 'Your role can review saved evidence. The company representative supplies and confirms the records.'
                  : 'Ask your organization administrator to review the evidence with an authorized company representative.'}
              </p>
              <Link
                className="button primary"
                href={href('/company') + (nextFact ? `#fact-${nextFact.id}` : '#company-readiness')}
              >
                {nextFact ? 'Open record for review' : 'Start readiness review'}
              </Link>
            </section>
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
                  <small>Records available in your current view</small>
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
            <Assistant organizationId={org.id} name={org.operating_name} />
          </>
        )}
        {!recordId && page === 'Assistant' && (
          <Assistant organizationId={org.id} name={org.operating_name} expanded />
        )}
        {!recordId && page === 'Assistant' && admin && <AssistantUsage organizationId={org.id} />}
        {recordId && (
          <Assistant
            key={recordId}
            organizationId={org.id}
            name={org.operating_name}
            context={{ kind: recordType === 'pursuit' ? 'pursuit' : 'opportunity', id: recordId }}
          />
        )}
        {!recordId && page === 'Company' && (
          <>
            <div className="company-hero">
              <span className="large-avatar">
                {org.operating_name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase()}
              </span>
              <div>
                <div className="eyebrow">COMPANY PASSPORT</div>
                <h2>{org.operating_name}</h2>
                <p>{org.legal_name}</p>
              </div>
              <span className="fit amber">{pending.length} visible facts need review</span>
            </div>
            <div className="info-note">
              Pending facts are working research, not approved proposal evidence. CSLB and SAM
              status are not assumed active. Unknown values remain unfilled.
            </div>
            <CompanyPassport key={org.id} data={data} />
            <section className="panel" id="company-readiness">
              <h2>Review your saved company evidence</h2>
              <p>
                Start with the company basics, then review the areas relevant to your work. Your
                representative supplies the records; an authorized reviewer checks the evidence.
              </p>
              <p>
                This is a review of records visible to your role, not a completeness score or
                eligibility decision. Restricted records may be hidden, and this view contains at
                most 500 facts. An empty area does not prove information is missing.
              </p>
              <p>
                Supporting uploads and proposal-use approvals are not yet available. Keep source
                references with each saved record; do not enter passwords or full tax identifiers.
              </p>
              <Link className="text-button" href={href('/documents')}>
                View authorized document records →
              </Link>
            </section>
            {readiness.groups.map((area) => (
              <details
                className="panel"
                key={area.id}
                open={area.facts.length > 0 || area.id === 'identity'}
              >
                <summary>
                  {area.title} · {area.facts.length} visible records
                </summary>
                <p>{area.why}</p>
                {admin && (
                  <CompanyRecordForm
                    organizationId={org.id}
                    types={area.types}
                    members={data.members}
                    userId={data.userId}
                  />
                )}
                <p>
                  {area.facts.length} visible records ·{' '}
                  {area.facts.filter((f) => reviewStatus(f, data.reviewAsOf) !== 'reviewed').length}{' '}
                  need review
                </p>
                {area.facts.length ? (
                  <div className="company-grid">
                    {area.facts.map((f) => (
                      <FactCard
                        fact={f}
                        members={data.members}
                        userId={data.userId}
                        org={org.id}
                        admin={admin}
                        asOf={data.reviewAsOf}
                        key={`${f.id}-${f.updated_at}`}
                      />
                    ))}
                  </div>
                ) : (
                  <p>
                    No records visible in this area. Confirm applicable information with your
                    administrator.
                  </p>
                )}
              </details>
            ))}
            {readiness.other.length > 0 && (
              <section className="panel">
                <h2>Other company records</h2>
                <div className="company-grid">
                  {readiness.other.map((f) => (
                    <FactCard
                      fact={f}
                      members={data.members}
                      userId={data.userId}
                      org={org.id}
                      admin={admin}
                      asOf={data.reviewAsOf}
                      key={`${f.id}-${f.updated_at}`}
                    />
                  ))}
                </div>
              </section>
            )}
            <section className="panel" id="company-onboarding">
              <h2>Needs information from {org.operating_name}</h2>
              <p>
                Confirm these with an authorized company representative. These checklist entries do
                not independently verify the company.
              </p>
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
            {capture && (
              <section className="panel">
                <h2>Record an opportunity</h2>
                <OpportunityForm data={data} />
              </section>
            )}
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
                  Record an opportunity from an official notice or a traceable source. An
                  administrator or capture manager can add it here.
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
                  This workspace starts with an empty pipeline. No bid decisions or awards have been
                  assumed.
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
