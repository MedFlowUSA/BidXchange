'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TenantData } from '../lib/tenant-types';
import {
  checklistLabels,
  gateLabels,
  followupLabels,
  type ResponseRelease,
} from '../lib/response-release';
import { saveReleaseAction } from '../app/response-release-actions';
import { readResponseDraft } from '../lib/response-package';
import { responseProgress } from '../lib/response-progress';
import PortalPlaybook from './portal-playbook';
import { EXTERNAL_COMPLETION, releaseHandoff } from '../lib/submission-handoff';

function ActionForm({
  build,
  children,
  label,
}: {
  build: (form: FormData) => unknown;
  children: React.ReactNode;
  label: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const router = useRouter();
  return (
    <form
      className="release-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = new FormData(e.currentTarget);
        setBusy(true);
        try {
          const payload = new FormData();
          payload.set('payload', JSON.stringify(build(form)));
          const result = await saveReleaseAction({ message: '' }, payload);
          setMessage(result.message);
          if (result.success) router.refresh();
        } catch {
          setMessage('Not recorded. Check the fields and retry.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        {children}
        <button className="button primary" type="submit">
          {busy ? 'Recording…' : label}
        </button>
      </fieldset>
      <p role="status">{message}</p>
    </form>
  );
}
function Field({
  name,
  label,
  type = 'text',
  required = true,
  maxLength = 2000,
  value,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  value?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        defaultValue={value}
      />
    </label>
  );
}
const value = (f: FormData, key: string) => String(f.get(key) ?? '').trim();
function FileManifest() {
  const [files, setFiles] = useState<{ name: string; sha256: string; reference: string }[]>([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <>
      <label>
        Final files — compute their SHA-256 locally
        <input
          type="file"
          multiple
          disabled={busy}
          onChange={async (e) => {
            const selected = Array.from(e.currentTarget.files ?? []);
            setFiles([]);
            setBusy(true);
            try {
              if (
                selected.length < 1 ||
                selected.length > 30 ||
                selected.some((f) => f.size > 50 * 1024 * 1024)
              )
                throw new Error('Select 1–30 files, each no larger than 50 MB.');
              const result = [];
              for (const file of selected) {
                const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
                result.push({
                  name: file.name,
                  sha256: Array.from(new Uint8Array(digest), (b) =>
                    b.toString(16).padStart(2, '0'),
                  ).join(''),
                  reference: '',
                });
              }
              setFiles(result);
              setMessage('Hashes calculated locally. File bytes have not been uploaded.');
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Could not hash these files.');
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p role="status">{busy ? 'Calculating file hashes…' : message}</p>
      <p>
        Use the final files you reviewed, including completed company details and signatures. Keep
        them in your authorized repository. Do not enter passwords, access tokens or signed download
        URLs.
      </p>
      {files.map((file, i) => (
        <label key={i}>
          {file.name} — storage reference
          <input
            required
            maxLength={1000}
            value={file.reference}
            onChange={(e) =>
              setFiles((old) =>
                old.map((f, j) => (i === j ? { ...f, reference: e.target.value } : f)),
              )
            }
          />
          <small className="release-checksum">SHA-256 {file.sha256}</small>
        </label>
      ))}
      <input type="hidden" name="files" value={JSON.stringify(files)} />
    </>
  );
}
function Freeze({ data, pursuitId }: { data: TenantData; pursuitId: string }) {
  const packages = data.responsePackages ?? [];
  return (
    <details>
      <summary>Prepare a version for human approval</summary>
      <p>
        This freezes the saved response, reviewed source context and final file manifest. It does
        not sign documents or send files to a buyer. Unknown checklist items prevent approval.
      </p>
      <ActionForm
        label="Freeze response version"
        build={(f) => {
          if (f.get('external_completion') !== 'on')
            throw new Error('Confirm external completion.');
          const p = packages.find((p) => p.id === value(f, 'package'));
          return {
            action: 'freeze',
            organization: data.organization.id,
            pursuit: pursuitId,
            package: p?.id,
            version: p?.updated_at,
            context: data.releaseWorkflow?.context,
            checklist: {
              ...Object.fromEntries(
                Object.keys(checklistLabels).map((k) => [
                  k,
                  {
                    status: value(f, k),
                    reference:
                      value(f, k + '-reference') +
                      (['pricing', 'signatures', 'certifications'].includes(k)
                        ? `\n${EXTERNAL_COMPLETION}`
                        : ''),
                  },
                ]),
              ),
              method: value(f, 'method'),
              portal: value(f, 'portal'),
              source_version: value(f, 'source_version'),
              reviewed_at: value(f, 'reviewed_at'),
              submitter: value(f, 'submitter'),
              files: JSON.parse(value(f, 'files')),
            },
          };
        }}
      >
        <label>
          Saved response
          <select name="package" aria-label="Saved response" required>
            {packages.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title} — {p.updated_at}
              </option>
            ))}
          </select>
        </label>
        <Field
          name="source_version"
          label="Official source / amendment version reviewed"
          maxLength={500}
        />
        <Field
          name="reviewed_at"
          label="Source reviewed at (ISO timestamp with timezone, e.g. 2026-09-21T09:00:00-07:00)"
        />
        <Field name="method" label="Required submission method" maxLength={200} />
        <Field name="portal" label="Buyer portal URL or submission destination (no credentials)" />
        <label>
          Named submitter
          <select name="submitter" aria-label="Named submitter" required>
            <option value="">Select an active authorized member</option>
            {data.members
              .filter(
                (m) =>
                  m.status === 'active' &&
                  ['organization_admin', 'capture_manager', 'executive_approver'].includes(m.role),
              )
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id === data.userId ? 'You' : m.user_id} — {m.role.replaceAll('_', ' ')}
                </option>
              ))}
          </select>
        </label>
        {Object.entries(checklistLabels).map(([key, label]) => (
          <div key={key} className="release-check">
            <label>
              {label}
              <select name={key} aria-label={label} defaultValue="unknown">
                <option value="unknown">Unknown</option>
                <option value="needs_review">Needs review</option>
                <option value="missing">Missing</option>
                <option value="confirmed">Confirmed</option>
                <option value="not_applicable">Not applicable</option>
              </select>
            </label>
            <Field
              name={key + '-reference'}
              label={`${label}: confirmation reference or reason`}
              maxLength={['pricing', 'signatures', 'certifications'].includes(key) ? 1900 : 2000}
              required={false}
            />
          </div>
        ))}
        <FileManifest />
        <label className="checklist-row">
          <input type="checkbox" required name="external_completion" />
          Price and representations are complete outside BidXchange
        </label>
      </ActionForm>
    </details>
  );
}
function Version({ data, release: v }: { data: TenantData; release: ResponseRelease }) {
  const [followupEvent, setFollowupEvent] = useState('agency_question');
  const isOutcome = ['award', 'loss', 'cancelled'].includes(followupEvent);
  const workflow = data.releaseWorkflow!,
    role = data.organization.role,
    org = data.organization.id;
  const approvalHistory = workflow.approvals.filter((h) => h.release_id === v.id),
    submissions = workflow.submissions.filter((h) => h.release_id === v.id),
    followups = workflow.followups.filter((h) => h.release_id === v.id);
  const executive = ['organization_admin', 'executive_approver'].includes(role),
    capture = ['organization_admin', 'executive_approver', 'capture_manager'].includes(role);
  const canSubmit = capture && v.snapshot.checklist.submitter === data.userId;
  const previous = workflow.submissions[0]?.id ?? null;
  const handoff = releaseHandoff(v.snapshot.checklist, v.checksum, v.status);
  const externalComplete = handoff.externalComplete;
  const handoffReady = handoff.ready;
  return (
    <article className="panel" id={`release-${v.id}`}>
      <h3>
        {v.snapshot.title} · version {v.sequence}
      </h3>
      <p>
        <strong>{v.status?.state ?? 'Needs review'}</strong> · Frozen {v.created_at}
      </p>
      <p>
        <strong>{handoffReady ? 'Ready for human handoff' : 'Not ready for handoff'}</strong>
      </p>
      {!externalComplete && (
        <p>
          Prepare a new version with the explicit external price and representations confirmation.
          Historical versions are preserved.
        </p>
      )}
      <p className="release-checksum">Checksum {v.checksum}</p>
      <p>
        Deadline: {v.snapshot.opportunity.deadline ?? 'Unknown'} ·{' '}
        {v.snapshot.opportunity.timezone ?? 'Timezone unknown'}. Named submitter:{' '}
        {v.snapshot.checklist.submitter === data.userId ? 'You' : v.snapshot.checklist.submitter}.
      </p>
      <ul>
        {handoff.gaps.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <a
        className="button primary"
        href={`/api/response-releases/handoff?organization=${org}&release=${v.id}&checksum=${v.checksum}&format=pdf`}
      >
        Download handoff checklist (PDF)
      </a>{' '}
      <a
        href={`/api/response-releases/handoff?organization=${org}&release=${v.id}&checksum=${v.checksum}`}
      >
        Download internal handoff packet (JSON)
      </a>
      <p>
        The packet preserves the reviewed snapshot and file hashes. It is not proof of buyer
        receipt. Draft exports remain drafts; independently verify the final files against this
        manifest.
      </p>
      <PortalPlaybook
        portal={`${v.snapshot.checklist.method} ${v.snapshot.checklist.portal}`}
        destination={v.snapshot.checklist.portal}
      />
      <details>
        <summary>Checklist and final files</summary>
        <dl>
          {Object.entries(checklistLabels).map(([k, label]) => {
            const item = v.snapshot.checklist[k as keyof typeof checklistLabels];
            return (
              <div key={k}>
                <dt>{label}</dt>
                <dd>
                  {item.status.replaceAll('_', ' ')} — {item.reference || 'No reference'}
                </dd>
              </div>
            );
          })}
        </dl>
        {v.snapshot.checklist.files.map((f, i) => (
          <p key={i} className="release-checksum">
            {f.name} · {f.reference}
            <br />
            SHA-256 {f.sha256}
          </p>
        ))}
      </details>
      <details>
        <summary>Human approval gates</summary>
        <p>
          Each decision binds to this checksum. Pricing and compliance must precede final approval;
          final approval must precede submission authorization. Conditions are recorded context, not
          automatically checked or cleared.
        </p>
        {Object.entries(gateLabels).map(([gate, label]) => {
          const latest = approvalHistory.find((h) => h.approval_type === gate),
            allowed = executive || (gate === 'pricing' && role === 'estimator');
          return (
            <section className="release-check" key={gate}>
              <h4>
                {label}: {v.status?.approvals[gate] ? 'Current' : 'Not current'}
              </h4>
              {allowed && !workflow.partial ? (
                <ActionForm
                  label="Record decision"
                  build={(f) => ({
                    action: 'approve',
                    organization: org,
                    release: v.id,
                    checksum: v.checksum,
                    gate,
                    decision: value(f, 'decision'),
                    rationale: value(f, 'rationale'),
                    conditions: value(f, 'conditions'),
                    previous: latest?.id ?? null,
                  })}
                >
                  <label>
                    Decision
                    <select name="decision" aria-label="Decision" required defaultValue="">
                      <option value="" disabled>
                        Select a decision
                      </option>
                      <option value="approved">Approve</option>
                      <option value="rejected">Reject</option>
                      <option value="revoked">Revoke</option>
                    </select>
                  </label>
                  <Field name="rationale" label="Rationale" />
                  <Field name="conditions" label="Conditions / scope (optional)" required={false} />
                </ActionForm>
              ) : (
                <p>
                  {workflow.partial
                    ? 'History limit reached; actions are paused.'
                    : 'An administrator or executive approver is required. Estimators can approve pricing.'}
                </p>
              )}
            </section>
          );
        })}
        <h4>Decision history</h4>
        {approvalHistory.map((h) => (
          <p key={h.id}>
            {gateLabels[h.approval_type]} · {h.decision} · {h.approver} ({h.role_at_decision}) ·{' '}
            {h.decided_at}
            <br />
            {h.rationale}
            {h.conditions && ` · Conditions: ${h.conditions}`}
          </p>
        ))}
        {!approvalHistory.length && <p>No decisions recorded.</p>}
      </details>
      <details>
        <summary>Record an actual human submission</summary>
        <p>
          Submit through the official buyer channel yourself, then record what happened. BidXchange
          does not submit, verify delivery or create a legal signature. Portal credentials must
          remain outside BidXchange.
        </p>
        {canSubmit && !workflow.partial ? (
          <ActionForm
            label="Record human submission"
            build={(f) => ({
              action: 'submit',
              organization: org,
              release: v.id,
              checksum: v.checksum,
              previous,
              confirmed: f.get('confirmed') === 'on',
              details: Object.fromEntries(
                [
                  'kind',
                  'method',
                  'portal',
                  'submitted_at',
                  'confirmation',
                  'receipt',
                  'receipt_limitation',
                  'notes',
                  'followup_at',
                ].map((k) => [k, value(f, k)]),
              ),
            })}
          >
            <label>
              Record type
              <select
                name="kind"
                aria-label="Record type"
                required
                defaultValue={previous ? 'correction' : 'initial'}
              >
                {!previous ? (
                  <option value="initial">Initial submission</option>
                ) : (
                  <>
                    <option value="correction">Correction of latest record for this version</option>
                    <option value="resubmission">Actual resubmission</option>
                  </>
                )}
              </select>
            </label>
            <Field
              name="method"
              label="Actual submission method"
              value={v.snapshot.checklist.method}
              maxLength={200}
            />
            <Field
              name="portal"
              label="Actual portal / destination"
              value={v.snapshot.checklist.portal}
            />
            <Field
              name="submitted_at"
              label="Actual submission time (ISO timestamp with timezone)"
            />
            <Field
              name="confirmation"
              label="Confirmation number (if issued)"
              required={false}
              maxLength={500}
            />
            <Field name="receipt" label="Receipt reference (text only)" required={false} />
            <Field
              name="receipt_limitation"
              label="If no receipt: explain what cannot be verified"
              required={false}
            />
            <Field name="notes" label="Submission notes / reason for correction or resubmission" />
            <Field
              name="followup_at"
              label="Follow-up date and time (optional ISO timestamp with timezone)"
              required={false}
            />
            <label>
              <input type="checkbox" name="confirmed" required />I am the named submitter. I confirm
              this record describes the actual submission of the files in this exact version.
            </label>
          </ActionForm>
        ) : (
          <p>
            Only the named active submitter may record this version. A complete current
            authorization is required for an initial submission or resubmission.
          </p>
        )}
        <h4>Immutable submission history</h4>
        {submissions.map((h) => (
          <p key={h.id}>
            {h.kind} · actually submitted {h.submitted_at} · recorded {h.recorded_at} by{' '}
            {h.recorded_by}
            <br />
            Confirmation: {h.details.confirmation || 'Not issued'} · Receipt:{' '}
            {h.details.receipt || h.details.receipt_limitation}
            <br />
            {h.details.notes}
          </p>
        ))}
        {!submissions.length && <p>No submission has been recorded.</p>}
      </details>
      {!!submissions.length && (
        <details>
          <summary>Post-submission follow-up</summary>
          {capture && !workflow.partial && (
            <ActionForm
              label="Record follow-up"
              build={(f) => ({
                action: 'followup',
                organization: org,
                release: v.id,
                event: value(f, 'event'),
                note: value(f, 'note'),
                due: value(f, 'due'),
                ...(isOutcome
                  ? {
                      outcome: {
                        date: value(f, 'outcome_date'),
                        source: value(f, 'outcome_source'),
                        awardee: value(f, 'outcome_awardee'),
                        amount: value(f, 'outcome_amount'),
                        reason: value(f, 'outcome_reason'),
                        debrief: value(f, 'outcome_debrief'),
                        disclosure: value(f, 'outcome_disclosure') || 'not_granted',
                      },
                    }
                  : {}),
              })}
            >
              <label>
                Event
                <select
                  name="event"
                  aria-label="Event"
                  value={followupEvent}
                  onChange={(e) => setFollowupEvent(e.target.value)}
                >
                  {Object.entries(followupLabels).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <Field name="note" label="What happened / next action" />
              {isOutcome && (
                <fieldset>
                  <legend>Document the outcome</legend>
                  <p>
                    Record only what the buyer or official notice states. Leave unknown award
                    details blank. These details are saved in the existing follow-up history, not
                    independently verified.
                  </p>
                  <label>
                    Outcome date
                    <input type="date" name="outcome_date" required />
                  </label>
                  <Field name="outcome_source" label="Official outcome source URL or reference" />
                  <Field
                    name="outcome_awardee"
                    label="Awardee, if officially known"
                    required={false}
                  />
                  <Field
                    name="outcome_amount"
                    label="Official award amount and currency (example: 850000 USD)"
                    required={false}
                  />
                  <Field name="outcome_reason" label="Outcome reason" />
                  <Field name="outcome_debrief" label="Debrief notes" required={false} />
                  {followupEvent === 'award' && (
                    <label>
                      Permission to disclose
                      <select
                        name="outcome_disclosure"
                        aria-label="Permission to disclose"
                        defaultValue="not_granted"
                      >
                        <option value="not_granted">Not granted / unknown</option>
                        <option value="granted">I have permission to disclose this award</option>
                      </select>
                    </label>
                  )}
                  <p>
                    An award is not completed past performance. No company evidence is created or
                    reused automatically.
                  </p>
                </fieldset>
              )}
              <Field
                name="due"
                label="Due date (optional ISO timestamp with timezone)"
                required={false}
              />
            </ActionForm>
          )}
          {followups.map((h) => (
            <p key={h.id}>
              {followupLabels[h.event_type]} · {h.recorded_at} · {h.recorded_by}
              <br />
              <span style={{ whiteSpace: 'pre-wrap' }}>{h.note}</span>
              {h.due_at && ` · Due ${h.due_at}`}
            </p>
          ))}
        </details>
      )}
    </article>
  );
}
export default function ResponseReleases({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const workflow = data.releaseWorkflow;
  const pursuit = data.pursuits.find((p) => p.id === pursuitId),
    source = data.opportunities.find((o) => o.id === pursuit?.opportunity_id);
  const requirements = (data.requirements ?? []).filter((r) => r.pursuit_id === pursuitId),
    saved = data.responsePackages?.[0],
    draft = saved ? readResponseDraft(saved.content) : null,
    progress = draft ? responseProgress(draft, data, pursuitId) : null;
  const findings = data.resolutions ?? [];
  return (
    <section className="panel response-releases" id="response-release">
      <h2>Submission handoff</h2>
      <PortalPlaybook
        portal={source?.source_url ?? ''}
        destination={source?.source_url ?? undefined}
      />
      {!saved && (
        <p>
          Start with the packet instructions here, then{' '}
          <a href="#response-packages">create a response outline</a> before freezing a version for
          approval.
        </p>
      )}
      <p>
        {source?.solicitation_number ?? 'Solicitation unknown'} · Source:{' '}
        {source?.source_url ?? source?.source_note ?? 'Not recorded'} · Deadline:{' '}
        {source?.official_deadline ?? 'Unknown'} ({source?.deadline_timezone ?? 'Timezone unknown'})
      </p>
      <p>
        {requirements.length} recorded requirements ·{' '}
        {
          requirements.filter((r) =>
            findings.some(
              (f) =>
                f.requirement_id === r.id &&
                f.review_current &&
                ['supported', 'waived'].includes(f.disposition),
            ),
          ).length
        }{' '}
        current supported / waived findings · {requirements.filter((r) => !r.owner_user_id).length}{' '}
        without owners.
      </p>
      <p>
        {progress
          ? `${progress.current} current written answers · ${progress.rows.filter((r) => r.missing).length} unanswered · ${progress.rows.filter((r) => r.placeholder).length} with placeholders · ${progress.rows.filter((r) => r.changed).length} stale.`
          : 'No readable saved response.'}{' '}
        Counts describe recorded work, not eligibility or completeness of the official solicitation.
      </p>
      <p>
        Saved draft: {saved?.updated_at ?? 'None'}. Forms, signatures, file formats and the named
        submitter remain unknown until a human completes the version checklist. PDF and Word exports
        are available in Response packages; export does not approve or submit them.
      </p>
      {!workflow?.enabled ? (
        <p>
          Versioned approval and submission recording is not activated in this environment. Exported
          drafts require your organization’s external review and human submission process.
        </p>
      ) : (
        <>
          <p>
            Separate steps: export a draft, review final files, freeze a version, obtain human
            approvals, submit through the buyer’s channel, then record the result.
          </p>
          {workflow.partial ? (
            <p role="alert">
              The history exceeds this view’s limit. Mutations are paused here; contact operations
              to retrieve the complete scoped history.
            </p>
          ) : ['organization_admin', 'capture_manager'].includes(data.organization.role) &&
            (data.responsePackages?.length ?? 0) > 0 ? (
            <Freeze data={data} pursuitId={pursuitId} />
          ) : (
            <p>
              A capture manager or administrator must save a response before preparing a review
              version.
            </p>
          )}
          {!workflow.versions.length && (
            <p>Not ready: no response version has been frozen for approval.</p>
          )}
          {workflow.versions.map((v) => (
            <Version key={v.id} data={data} release={v} />
          ))}
        </>
      )}
    </section>
  );
}
