'use client';
import Link from 'next/link';
import { useActionState, useState, useEffect } from 'react';
import AppShell from './app-shell';
import PursuitNextStep from './pursuit-next-step';
import { findSource } from '../lib/sources/registry';
import { hasCurrentRegisterSignoff } from '../lib/workspace-guide';
import ProfileCompletion from './profile-completion';
import CompanyReview from './company-review';
import CompanySnapshot from './company-snapshot';
import InformationRequests from './information-requests';
import CompanyPortal, { CompanyPanel } from './company-portal';
import DecisionMemoryPanel from './decision-memory';
import Dialog from './dialog';
import { GuideContent, GettingStarted, NextActions } from './workspace-guide';
import ResponseReleases from './response-release';
import Assistant from './assistant';
import SourceDetails from './source-details';
import { PepmaIntake, PepmaWorkflow } from './pepma-workflow';
import { isPepmaUrl } from '../lib/pepma';
import AssistantUsage from './assistant-usage';
import { displayDate } from '../lib/ai/policy';
import { freshnessRadar } from '../lib/california-passport';
import PursuitDecisionBrief from './pursuit-decision-brief';
import ContractReadinessBrief from './contract-readiness-brief';
import DeliveryReview from './delivery-review';
import RegisterSignoff from './register-signoff';
import { RequirementCorrection, RequirementArchive } from './requirement-lifecycle';
import ContractorTaskTemplate from './contractor-task-template';
import OpportunityAmendments from './opportunity-amendments';
import BidReview from './bid-review';
import NoticeExcerptReview from './notice-excerpt-review';
import ResponsePackages from './response-package';
import EvidenceStressTest from './evidence-stress-test';
import PursuitDecision from './pursuit-decision';
import RequirementResolution from './requirement-resolution';
import RequirementAmendment from './requirement-amendment';
import { DocumentLibrary, RequirementDocuments } from './document-library';
import TodayTaskQueue from './today-task-queue';
import CompanyRecordForm from './company-record-form';
import CompanyPassport from './company-passport';
import PortalShortcuts from './portal-shortcuts';
import EvidenceUseReview from './evidence-use-review';
import EvidenceRenewals from './evidence-renewals';
import EvidenceReminders from './evidence-reminders';
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
  structuredEnabled,
}: {
  fact: Fact;
  admin: boolean;
  org: string;
  asOf: string;
  members: TenantData['members'];
  userId: string;
  structuredEnabled?: boolean;
}) {
  const status = reviewStatus(fact, asOf);
  const verified = status === 'reviewed';
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const reveal = () => {
      if (location.hash === `#fact-${fact.id}`) setExpanded(true);
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [fact.id]);
  return (
    <details
      className="panel fact-card"
      id={`fact-${fact.id}`}
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary className="flex-between">
        <strong>{fact.label}</strong>
        <span className={`fit ${verified ? 'green' : 'amber'}`}>
          {status === 'reviewed' ? 'Evidence reviewed' : status.replaceAll('_', ' ')}
        </span>
      </summary>
      <strong>{fact.value ?? 'Not provided'}</strong>
      <p>{fact.source_note}</p>
      <div className="fact-source">
        Evidence: {fact.source_reference || 'Not provided'}
        {fact.verified_at && (
          <p>
            Human attestation: {new Date(fact.verified_at).toLocaleDateString()} ·{' '}
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
          structuredEnabled={structuredEnabled}
        />
      )}
      {admin && (
        <details>
          <summary>Review and attest evidence</summary>
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
              Human review status
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
                    {
                      {
                        unverified: 'Claimed — not attested',
                        pending_verification: 'Needs review',
                        verified: 'Attested by a person',
                        expiring: 'Expiring',
                        expired: 'Expired',
                        rejected: 'Rejected',
                      }[s]
                    }
                  </option>
                ))}
              </select>
            </label>
            <p>
              Save a new evidence reference as pending first. Then attest only after reviewing an
              authorized current source.
            </p>
          </ActionForm>
        </details>
      )}
    </details>
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
  const [companyQuery, setCompanyQuery] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [focusedFact, setFocusedFact] = useState('');
  useEffect(() => {
    const reveal = () => {
      if (location.hash.startsWith('#fact-')) {
        setFocusedFact(location.hash.slice(6));
        setCompanyQuery('');
        setReviewOnly(false);
      }
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, []);
  const visibleFact = (fact: Fact) =>
    (!reviewOnly || reviewStatus(fact, data.reviewAsOf) !== 'reviewed') &&
    `${fact.label} ${fact.value ?? ''}`.toLowerCase().includes(companyQuery.toLowerCase());
  const [notice, setNotice] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
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
  const download = () => {
    const text = [
      `${org.operating_name} — opportunity brief`,
      `Generated ${new Date().toISOString()}`,
      `${data.opportunities.length} recorded opportunities available in this workspace view.`,
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
      badges={{
        pursuit:
          (data.resolutions ?? []).filter((r) => r.review_current && r.disposition === 'blocked')
            .length +
          data.tasks.filter(
            (t) =>
              t.status !== 'complete' &&
              t.due_at &&
              Date.parse(t.due_at) < Date.parse(data.reviewAsOf),
          ).length,
        passport: freshnessRadar(data.facts, data.reviewAsOf).filter(
          (r) => r.stale || r.window === 'expired',
        ).length,
      }}
      assistant={
        <Assistant
          key={recordId ?? org.id}
          organizationId={org.id}
          name={org.operating_name}
          expanded
          hasOpportunities={data.opportunities.length > 0}
          context={
            recordId
              ? { kind: recordType === 'pursuit' ? 'pursuit' : 'opportunity', id: recordId }
              : undefined
          }
          planningData={recordType === 'pursuit' ? data : undefined}
        />
      }
      onHelp={() => setGuideOpen(true)}
    >
      {guideOpen && (
        <Dialog title="Workspace guide" close={() => setGuideOpen(false)} wide>
          <GuideContent data={data} pursuitId={pursuit?.id} />
        </Dialog>
      )}
      <main>
        {data.selfServiceEnabled && !recordId && page === 'Today' && (
          <div className="info-note">
            <Link href={workspaceHref('/onboarding', org.id)}>
              Continue company setup and your first opportunity →
            </Link>
          </div>
        )}
        {page === 'Today' && <GettingStarted data={data} onOpen={() => setGuideOpen(true)} />}
        {!recordId && ['Today', 'Opportunities', 'Pursuits'].includes(page) && (
          <NextActions
            data={data}
            page={page}
            pursuitId={pursuit?.id}
            opportunityId={recordType === 'opportunity' ? recordId : undefined}
          />
        )}
        {page === 'Today' && (!!data.sourceAttention || data.sourceIssue) && (
          <section className="panel">
            <h2>Source review needs attention</h2>
            {!!data.sourceAttention && <p>{data.sourceAttention} source records need review.</p>}
            {data.sourceIssue && (
              <p>
                Source synchronization is disabled, incomplete or stale. Check source freshness
                before relying on results.
              </p>
            )}
            <Link href={href('/opportunities/sources')}>Review source inbox →</Link>
          </section>
        )}
        {recordId &&
          recordType === 'opportunity' &&
          data.sourceProvenance?.some((s) => s.opportunity_id === recordId) && (
            <section className="panel">
              <p>
                This opportunity was converted from an observed SAM.gov notice. Local edits are
                company records; current official metadata and source changes are maintained
                separately.
              </p>
              <Link href={href('/opportunities/sources')}>
                Check source freshness and version history →
              </Link>
            </section>
          )}
        {(recordId || page !== 'Company') && (
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {org.operating_name.toUpperCase()} · {org.status.toUpperCase()}
              </div>
              <h1>
                {recordId
                  ? (pursuit?.title ?? opportunity?.title)
                  : page === 'Today'
                    ? 'Today'
                    : page === 'Assistant'
                      ? 'BidBuddy'
                      : page === 'Opportunities'
                        ? 'All bids'
                        : page}
              </h1>
              <p>
                {recordId
                  ? `${opportunity?.buyer ?? 'Buyer not recorded'} · ${deadline} · ${opportunity?.deadline_timezone ?? 'Time zone not recorded'}`
                  : page === 'Company'
                    ? 'Manage your profile, review your records and keep information current.'
                    : 'Authenticated organization data. Working facts require human verification.'}
              </p>
              {pursuit && opportunity && (
                <>
                  <p>
                    {opportunity.source_details?.place || 'Location not recorded'} ·{' '}
                    {opportunity.estimated_value == null
                      ? 'Value not stated'
                      : new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0,
                        }).format(opportunity.estimated_value)}{' '}
                    ·{' '}
                    {findSource(opportunity.source_details?.sourceId ?? '')?.name ??
                      'Portal not recorded'}
                  </p>
                  <div className="bid-chips">
                    <span>
                      {
                        (data.resolutions ?? []).filter(
                          (r) => r.review_current && r.disposition === 'blocked',
                        ).length
                      }{' '}
                      blockers
                    </span>
                    <span>
                      {hasCurrentRegisterSignoff(data)
                        ? 'Register signed off'
                        : 'Register needs review'}
                    </span>
                  </div>
                </>
              )}
            </div>
            {!recordId && (page === 'Reports' || page === 'Today') && (
              <button className="button secondary" onClick={download}>
                Export brief
              </button>
            )}
          </div>
        )}
        {notice && (
          <div className="info-note" role="status">
            {notice}
          </div>
        )}
        {recordType === 'opportunity' && opportunity && data.decisionMemory && (
          <DecisionMemoryPanel data={data} />
        )}
        {recordId && opportunity ? (
          recordType === 'pursuit' ? (
            <>
              {pursuit && <PursuitNextStep data={data} pursuitId={pursuit.id} />}
              <details className="panel">
                <summary>More on this bid</summary>
                {data.decisionMemory && <DecisionMemoryPanel data={data} />}
                {pursuit && <NextActions data={data} page={page} pursuitId={pursuit.id} />}
                {pursuit && <GuideContent data={data} pursuitId={pursuit.id} />}
                {pursuit && <BidReview data={data} pursuitId={pursuit.id} />}
                {pursuit && <ContractReadinessBrief data={data} pursuitId={pursuit.id} />}
                {pursuit && <DeliveryReview data={data} pursuitId={pursuit.id} />}
                {pursuit && <PursuitDecisionBrief data={data} pursuitId={pursuit.id} />}
                {pursuit && (
                  <EvidenceStressTest key={pursuit.id} data={data} pursuitId={pursuit.id} />
                )}
                {pursuit && isPepmaUrl(opportunity.source_url) && (
                  <PepmaWorkflow data={data} pursuitId={pursuit.id} canEdit={capture} />
                )}
                <Link href={href('/opportunities/' + opportunity.id)}>
                  Source notice and intake →
                </Link>
              </details>
              <section className="panel" aria-labelledby="requirements-heading">
                <span id="pursuit-requirements" />
                <h2 id="requirements-heading">Requirements register</h2>
                <p>Incomplete until signed off.</p>
                {capture && (
                  <NoticeExcerptReview
                    key={`notice:${org.id}:${recordId}`}
                    data={data}
                    pursuitId={recordId}
                  />
                )}
                <p>
                  Capture the notice requirements and assign the next review. This register does not
                  verify compliance or determine eligibility.
                </p>
                <Link href={href('/company')}>Review company evidence</Link>
                {!(data.requirements ?? []).length && (
                  <p>
                    No requirements recorded for this pursuit yet. This does not mean the notice has
                    no requirements.
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
                    {!(
                      data.resolutionsEnabled &&
                      data.resolutions?.some(
                        (r) => r.requirement_id === requirement.id && r.review_current,
                      )
                    ) && (
                      <p>
                        Follow-up:{' '}
                        {Object.hasOwn(requirementStatuses, requirement.status)
                          ? requirementStatuses[
                              requirement.status as keyof typeof requirementStatuses
                            ]
                          : 'Needs review'}
                      </p>
                    )}
                    <p>
                      Owner:{' '}
                      {requirement.owner_user_id === data.userId
                        ? 'You'
                        : (requirement.owner_user_id ?? 'Unassigned')}
                    </p>
                    {capture && (
                      <RequirementForm data={data} pursuitId={recordId} requirement={requirement} />
                    )}
                    {data.resolutionsEnabled && (
                      <RequirementResolution data={data} requirement={requirement} />
                    )}
                    {capture && <RequirementAmendment data={data} requirement={requirement} />}
                    {capture && (
                      <RequirementCorrection
                        key={`correct:${requirement.id}:${requirement.updated_at}`}
                        data={data}
                        requirement={requirement}
                      />
                    )}
                    {data.documentsEnabled && (
                      <RequirementDocuments data={data} requirement={requirement} />
                    )}
                    {data.evidenceReviewsEnabled && (
                      <EvidenceUseReview data={data} requirement={requirement} />
                    )}
                  </article>
                ))}
                {capture && <RequirementForm data={data} pursuitId={recordId} />}
                <RequirementArchive data={data} />
                {pursuit && <RegisterSignoff data={data} pursuitId={pursuit.id} />}
              </section>
              <section className="panel" id="pursuit-tasks">
                <h2>Tasks</h2>
                <ContractorTaskTemplate data={data} pursuitId={recordId} />
                {data.tasks
                  .filter((t) => t.pursuit_id === recordId)
                  .map((t) => (
                    <div className="panel" key={t.id} id={`task-${t.id}`}>
                      <h3>{t.title}</h3>
                      <p>
                        {t.status.replaceAll('_', ' ')} · Owner:{' '}
                        {t.assigned_user_id === data.userId
                          ? 'You'
                          : (t.assigned_user_id ?? 'Unassigned')}
                      </p>
                      <p>Due: {displayDate(t.due_at, t.due_timezone ?? org.default_timezone)}</p>
                      {t.requirement_id &&
                        data.archivedRequirements?.some((r) => r.id === t.requirement_id) && (
                          <p>
                            This task remains linked to an archived requirement. Review the{' '}
                            <a href="#requirement-archive-title">correction history</a> before
                            completing or updating it.
                          </p>
                        )}
                      {capture && <TaskForm data={data} pursuitId={recordId} task={t} />}
                    </div>
                  ))}
                {!data.tasks.some((t) => t.pursuit_id === recordId) && (
                  <p>No tasks assigned yet. Add the next action with an owner and deadline.</p>
                )}
                {capture && <TaskForm data={data} pursuitId={recordId} />}
              </section>
              {data.decisionsEnabled && pursuit && (
                <PursuitDecision data={data} pursuit={pursuit} />
              )}
              <ResponsePackages
                key={`response:${org.id}:${recordId}`}
                data={data}
                pursuitId={recordId}
              />
              <ResponseReleases data={data} pursuitId={recordId} />
              {pursuit && (
                <details className="panel">
                  <summary>Amendments</summary>
                  <OpportunityAmendments data={data} pursuitId={pursuit.id} />
                </details>
              )}
            </>
          ) : (
            <section className="panel record-page">
              <Link href={href('/opportunities')}>← Back to opportunities</Link>
              <h2>Scope</h2>
              <SourceDetails data={data} opportunity={opportunity} />
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
              {opportunity.source_url && opportunity.source_note && (
                <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {opportunity.source_note}
                </p>
              )}
              {isPepmaUrl(opportunity.source_url) && (
                <p>
                  PEPMA invitation recorded manually. Start or open the pursuit to review addenda,
                  company evidence and proposal deliverables. Edit opportunity to update the source
                  notes after checking PEPMA.
                </p>
              )}
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
            <section className="panel">
              <div className="eyebrow">NEXT ACTION</div>
              <h2>
                {!data.opportunities.length
                  ? 'Record one notice you want to review'
                  : !data.pursuits.length
                    ? 'Choose a notice and start a pursuit'
                    : 'Continue your bid review'}
              </h2>
              <p>
                Start with a PEPMA invitation or another buyer’s notice. You can record it before
                finishing the Passport; missing evidence stays visible during the review.
              </p>
              <Link
                className="button primary"
                href={href(data.pursuits.length ? '/pursuits' : '/opportunities')}
              >
                {data.pursuits.length ? 'Open pursuits' : 'Open opportunity intake'}
              </Link>
            </section>
            <TodayTaskQueue data={data} />
            <InformationRequests key={org.id + '-requests-today'} data={data} compact />
            <EvidenceReminders data={data} />
            <EvidenceRenewals key={org.id} data={data} />
          </>
        )}
        {!recordId && page === 'Assistant' && (
          <>
            <section className="panel">
              <h2>Plan work on a selected bid</h2>
              <p>
                Open a pursuit to ask for a source-backed action plan and review proposed tasks
                before saving them.
              </p>
              {data.pursuits.length ? (
                <ul>
                  {data.pursuits.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <Link href={href(`/pursuits/${p.id}`) + '#bid-assistant'}>{p.title}</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Create a pursuit from an opportunity to start a bid plan.</p>
              )}
              <Link href={href('/pursuits')}>Browse pursuits</Link>
            </section>
            <section className="panel">
              <h2>Opportunity research</h2>
              <p>
                Ask about opportunities, refine search filters, and compare visible company evidence
                with available records.
              </p>
              <Link className="button primary" href={`/assistant/research?organization=${org.id}`}>
                Open BidBuddy opportunity research
              </Link>
            </section>
          </>
        )}
        {!recordId && page === 'Assistant' && admin && <AssistantUsage organizationId={org.id} />}
        {!recordId && page === 'Company' && (
          <>
            <CompanyPortal key={org.id} data={data} reviewCount={pending.length}>
              {data.decisionMemoryEnabled && (
                <CompanyPanel name="decisions">
                  <DecisionMemoryPanel data={data} />
                </CompanyPanel>
              )}
              <CompanyPanel name="overview">
                <CompanySnapshot data={data} />
                <ProfileCompletion data={data} />
                <EvidenceRenewals key={org.id + '-overview-radar'} data={data} />
              </CompanyPanel>
              <CompanyPanel name="review">
                <CompanyReview key={org.id + '-review'} data={data} />
              </CompanyPanel>
              <CompanyPanel name="dates">
                <EvidenceReminders data={data} />
                <EvidenceRenewals key={org.id + '-renewals'} data={data} />
              </CompanyPanel>
              <CompanyPanel name="edit">
                <CompanyPassport key={org.id} data={data} />
              </CompanyPanel>
              <CompanyPanel name="records">
                <section className="panel" id="company-readiness">
                  <h2>Saved company records</h2>
                  <p>Find a record to check its source, update details or review its evidence.</p>
                  <details>
                    <summary>About access and evidence review</summary>
                    <p>
                      This is a review of records visible to your role, not a completeness score or
                      eligibility decision. Restricted records may be hidden, and this view contains
                      at most 500 facts. An empty area does not prove information is missing.
                    </p>
                    <p>
                      Supporting uploads and proposal-use approvals are not yet available. Keep
                      source references with each saved record; do not enter passwords or full tax
                      identifiers.
                    </p>
                  </details>
                  <Link className="text-button" href={href('/documents')}>
                    View authorized document records →
                  </Link>
                </section>
                <section
                  className="panel company-evidence-search"
                  aria-label="Find company evidence"
                >
                  <label>
                    Search saved evidence
                    <input
                      aria-label="Search saved evidence"
                      value={companyQuery}
                      onChange={(e) => setCompanyQuery(e.target.value)}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={reviewOnly}
                      onChange={(e) => setReviewOnly(e.target.checked)}
                    />{' '}
                    Only records needing review
                  </label>
                  {pending[0] && (
                    <p>
                      <a className="button secondary" href={`#fact-${pending[0].id}`}>
                        Review next record
                      </a>
                    </p>
                  )}
                  <p>
                    Open a section, then a record to review its source or edit it. Counts describe
                    saved records, not complete qualifications.
                  </p>
                  {!data.facts.some(visibleFact) && (
                    <p role="status">
                      No saved records match these filters. Clear the search or change the review
                      filter.
                    </p>
                  )}
                </section>
                {readiness.groups.map((area) => (
                  <details
                    className="panel"
                    key={area.id}
                    open={
                      Boolean(companyQuery) ||
                      reviewOnly ||
                      area.facts.some((f) => f.id === focusedFact)
                    }
                  >
                    <summary>
                      {area.title} · {area.facts.filter(visibleFact).length} shown ·{' '}
                      {
                        area.facts.filter((f) => reviewStatus(f, data.reviewAsOf) === 'reviewed')
                          .length
                      }{' '}
                      of {area.facts.length} reviewed
                    </summary>
                    <p>{area.why}</p>
                    {admin && (
                      <CompanyRecordForm
                        organizationId={org.id}
                        types={area.types}
                        structuredEnabled={data.structuredProfilesEnabled}
                        members={data.members}
                        userId={data.userId}
                      />
                    )}
                    <p>
                      {area.facts.length} visible records ·{' '}
                      {
                        area.facts.filter((f) => reviewStatus(f, data.reviewAsOf) !== 'reviewed')
                          .length
                      }{' '}
                      need review
                    </p>
                    {area.facts.length ? (
                      <div className="company-grid">
                        {area.facts.filter(visibleFact).map((f) => (
                          <FactCard
                            structuredEnabled={data.structuredProfilesEnabled}
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
                      {readiness.other.filter(visibleFact).map((f) => (
                        <FactCard
                          structuredEnabled={data.structuredProfilesEnabled}
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
              </CompanyPanel>
              <CompanyPanel name="requests">
                <InformationRequests data={data} />
              </CompanyPanel>
            </CompanyPortal>
          </>
        )}
        {!recordId && page === 'Opportunities' && (
          <>
            {capture && (
              <section className="panel">
                <h2>Add your next opportunity</h2>
                <p>
                  Open Add opportunity below to enter a buyer’s notice. Save it, then choose Start
                  pursuit on the saved record.
                </p>
                <OpportunityForm data={data} />
              </section>
            )}
            <section className="panel">
              <PortalShortcuts />
              <Link href={href('/opportunities/registry')}>
                Manage portals, registrations and data connections
              </Link>
            </section>
            {capture && <PepmaIntake data={data} />}
            <section className="panel">
              <Link href={href('/opportunities/sources')}>Source inbox →</Link>
              <p>
                Review official source matches and observed changes separately from manually
                recorded opportunities.
              </p>
            </section>

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
                    <small>
                      {data.sourceProvenance?.some((s) => s.opportunity_id === o.id)
                        ? 'Official SAM.gov source · review current metadata in Source inbox'
                        : isPepmaUrl(o.source_url)
                          ? 'PEPMA · manually recorded invitation'
                          : 'Manually recorded opportunity'}
                    </small>
                    <span className="fit amber">Needs human review</span>
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
                  A pursuit is the workspace for reviewing requirements, assigning tasks and
                  preparing your response to a saved notice.
                </p>
                <Link className="button primary" href={href('/opportunities')}>
                  Record or choose an opportunity
                </Link>
                <p>
                  This workspace starts with an empty pipeline. No bid decisions or awards have been
                  assumed.
                </p>
              </div>
            )}
          </div>
        )}
        {!recordId && page === 'Documents' && data.documentsEnabled && (
          <DocumentLibrary data={data} />
        )}
        {!recordId && page === 'Documents' && !data.documentsEnabled && (
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
                  Counts reflect records available in this workspace, including authorized source
                  imports when enabled; they are not a count of the external market.
                </p>
              </section>
              <section className="panel">
                <h2>Work needing attention</h2>
                <p>
                  {data.tasks.filter((t) => t.status !== 'complete').length} open tasks ·{' '}
                  {pending.length} company records needing review. Open a pursuit to review its
                  blockers, decision and submission history.
                </p>
              </section>
            </div>
            {admin && (
              <details className="panel activity-panel">
                <summary>Administrator audit log — technical event history</summary>
                {data.audit.map((a) => (
                  <div className="activity-row" key={a.id}>
                    {new Date(a.created_at).toLocaleString()} · {a.action} · {a.entity_table}
                  </div>
                ))}
                {!data.audit.length && <p>No audit events are available in this view.</p>}
              </details>
            )}
          </>
        )}
        {!recordId && page === 'Settings' && (
          <>
            <div className="info-note">
              Signed in as {data.userEmail}. Your role: {org.role.replaceAll('_', ' ')}.
              <p>
                <Link href="/settings/security">Account security and sign out all devices</Link>
              </p>
              {data.selfServiceEnabled && (
                <p>
                  <Link href="/onboarding">Your companies, invitations and setup checklist</Link>
                </p>
              )}
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
              {data.selfServiceEnabled && admin ? (
                <p>
                  <Link className="button secondary" href={workspaceHref('/settings/team', org.id)}>
                    Create and manage team invitations
                  </Link>
                </p>
              ) : (
                <p>Your company administrator manages invitations and access.</p>
              )}
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
          <span>BidXchange · Better evidence. Stronger pursuits.</span>
          <span>{org.operating_name}</span>
        </footer>
      </main>
    </AppShell>
  );
}
