'use client';

import { useEffect, useState } from 'react';
import { useDemoPassport } from './demo-passport-state';
import { handoffGaps } from '../lib/submission-handoff';
import PortalPlaybook from './portal-playbook';
import { noticeCandidates } from '../lib/notice-excerpt';
import { californiaSuggestions, californiaRulesVersion } from '../lib/california-rules';
import type { Opportunity } from '../lib/demo';

type Review = 'needs_review' | 'reviewed' | 'blocker' | 'not_applicable';
const initialRequirements = [
  [
    'License classification',
    'Have a person compare the electrical scope with the claimed CSLB classifications.',
    'Sample notice §2',
    'CSLB: DEMO-ONLY · B / C-10; attestation by Alex',
  ],
  [
    'DIR registration',
    'Review the claimed public-works registration.',
    'Sample notice §2.1',
    'DIR: DEMO-ONLY; source check',
  ],
  [
    'Bid bond',
    'Confirm a bid bond and available capacity with the surety.',
    'Sample notice §3',
    'Single-project band $1M–$2M; aggregate availability unresolved',
  ],
  [
    'Mandatory job walk',
    'Assign attendance and record the instructions.',
    'Sample notice §4',
    'Meeting task owned by Jordan',
  ],
  [
    'Prevailing wage',
    'Review the wage determination and applicable instructions.',
    'Sample notice §5',
    'Claimed public-works experience; human review required',
  ],
  [
    'Certified payroll',
    'Confirm the payroll process and responsible person.',
    'Sample notice §5.1',
    'Payroll process note owned by Alex',
  ],
  [
    'General liability insurance',
    'Review the policy dates and requested endorsements.',
    'Sample notice §6',
    'General liability policy: expired; renewal needed',
  ],
  [
    'Relevant experience',
    'Choose only projects permitted for disclosure.',
    'Sample notice §7',
    'Three fictional lighting/controls projects, 2023–2025; disclosure permitted in this exercise',
  ],
  [
    'Submission instructions',
    'Confirm the external destination, deadline and time zone.',
    'Sample notice §8',
    'PlanetBids-style destination; sample only',
  ],
  [
    'Addendum acknowledgment',
    'Check for changes before approving a response.',
    'Sample notice §9',
    'Original notice; check for addenda',
  ],
].map(([title, text, source, evidence], i) => ({
  title,
  text,
  source,
  evidence,
  status: (i === 2 ? 'blocker' : 'needs_review') as Review,
  note: '',
}));
const placeholder = '[HUMAN INPUT REQUIRED]';

/** Uses fictional, in-memory records. No provider or procurement mutation is made. */
export default function DemoBidRehearsal({
  opportunity,
  onAttention,
}: {
  opportunity: Opportunity;
  onAttention?: (count: number) => void;
}) {
  const { insuranceCurrent, setInsuranceCurrent } = useDemoPassport();
  const [requirements, setRequirements] = useState(initialRequirements);
  const [revision, setRevision] = useState(1);
  const [signoff, setSignoff] = useState<{ revision: number; at: string }>();
  const [decision, setDecision] = useState<{
    value: 'bid' | 'no_bid';
    revision: number;
    reason: string;
    at: string;
    blockers: string[];
  }>();
  const [reason, setReason] = useState('');
  const [reasonCode, setReasonCode] = useState('strategic');
  const [hours, setHours] = useState('');
  const [draft, setDraft] = useState('');
  const [version, setVersion] = useState(0);
  const [draftRevision, setDraftRevision] = useState(0);
  const [approved, setApproved] = useState<number>();
  const [amendment, setAmendment] = useState(0);
  const [acknowledged, setAcknowledged] = useState<string>();
  const [humanComplete, setHumanComplete] = useState(false);
  const [submitter, setSubmitter] = useState('');
  const [destination, setDestination] = useState('');
  const [submittedAt, setSubmittedAt] = useState('');
  const [intendedAt, setIntendedAt] = useState('2026-10-08T13:00');
  const [receipt, setReceipt] = useState('');
  const [ackNote, setAckNote] = useState('');
  const [submitted, setSubmitted] = useState<{
    version: number;
    receipt: string;
    submitter: string;
    destination: string;
    intended: string;
    actual: string;
    note: string;
    at: string;
  }>();
  const [history, setHistory] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [tasks, setTasks] = useState([false, false, false, false, false, false, false]);
  const [notice, setNotice] = useState('');
  const [sourceLocation, setSourceLocation] = useState('');
  const [candidates, setCandidates] = useState<ReturnType<typeof noticeCandidates>>();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const taskNames = [
    'Alex: confirm license classification',
    'Casey: request bid bond and capacity letter',
    'Jordan: calendar and attend mandatory job walk',
    'Alex: confirm DIR, wages and payroll',
    'Casey: review insurance endorsements',
    'Jordan: confirm submitter, portal and deadline',
    'Alex: review all addenda',
  ];
  const signed = signoff?.revision === revision;
  const currentDecision = decision?.revision === revision;
  const reviewed = requirements.every((r) => r.status !== 'needs_review' && r.note.trim());
  const remaining = requirements.filter(
    (r) => r.status === 'needs_review' || !r.note.trim(),
  ).length;
  const blockers = requirements.filter((r) => r.status === 'blocker');
  const approvedCurrent = approved === version && version > 0 && draftRevision === revision;
  const gaps = handoffGaps({
    signed,
    evidenceCurrent: insuranceCurrent,
    addendaAcknowledged: amendment === 0 || !!acknowledged,
    bidCurrent: currentDecision && decision?.value === 'bid',
    submitter,
    destination,
    humanComplete,
  });
  const ready = gaps.length === 0;
  const next = !insuranceCurrent
    ? ['Update general liability insurance', 'bid-evidence']
    : !signed
      ? [`Review remaining requirements (${remaining} left)`, 'bid-register']
      : !currentDecision
        ? ['Record bid or no-bid', 'bid-decision']
        : decision?.value === 'no_bid'
          ? ['Review recorded no-bid decision', 'bid-decision']
          : !ready
            ? ['Open submission handoff', 'bid-handoff']
            : !version
              ? ['Create response outline', 'bid-outline']
              : ['Record submission', 'bid-submission'];
  useEffect(() => {
    onAttention?.(blockers.length);
  }, [blockers.length, onAttention]);
  function log(text: string) {
    setHistory((old) => [...old, `${new Date().toISOString()} · ${text}`]);
    setMessage(text);
  }
  function invalidate(text: string) {
    setRevision((r) => r + 1);
    setHumanComplete(false);
    log(
      `${text} Register sign-off, decision and draft approval require renewed review. Previous history is preserved.`,
    );
  }
  function recordDecision(value: 'bid' | 'no_bid') {
    if (!signed || !reason.trim() || (value === 'bid' && blockers.length)) return;
    const at = new Date().toISOString();
    const snapshot = blockers.map((r) => `${r.title}: ${r.note}`);
    setDecision({ value, revision, reason: reason.trim(), at, blockers: snapshot });
    setApproved(undefined);
    log(
      `Alex recorded ${value === 'bid' ? 'bid' : 'no-bid'} at revision ${revision}. Reason ${reasonCode}: ${reason.trim()}. Estimated effort ${hours || 'not entered'} hours. Blocker snapshot: ${snapshot.join('; ') || 'None'}.`,
    );
  }
  function outline() {
    setDraft(
      `SAMPLE RESPONSE — DO NOT SUBMIT\n${opportunity.title}\nApex Energy Demo LLC · Redlands, CA\n${requirements.map((r, i) => `${r.title}: ${r.status === 'reviewed' && (i !== 6 || insuranceCurrent) ? (i === 6 ? 'Renewed GL policy; confirm endorsements' : r.evidence) : placeholder}`).join('\n')}\nTechnical approach: ${placeholder}\nPricing: ${placeholder}\nSignature: ${placeholder}`,
    );
    setVersion((v) => v + 1);
    setDraftRevision(revision);
    setApproved(undefined);
    log('Created an unapproved response outline; human-input placeholders remain visible.');
  }
  function exportDraft() {
    const url = URL.createObjectURL(
      new Blob(
        [draft + '\n\nSample data. Human review required. BidXchange does not submit bids.'],
        { type: 'text/plain' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `sample-response-v${version}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const deadline = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: opportunity.timezone,
  }).format(new Date(opportunity.deadline));
  return (
    <section className="bid-workspace" aria-label="Bid workspace">
      <header className="bid-heading">
        <div className="eyebrow">APEX ENERGY DEMO</div>
        <h1>{opportunity.title}</h1>
        <p>
          {opportunity.buyer} · {opportunity.location}
        </p>
        <p>
          {opportunity.value === null
            ? 'Value not recorded'
            : new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(opportunity.value)}{' '}
          · Due {deadline} · {opportunity.timezone} · PlanetBids-style portal
        </p>
        <div className="bid-chips">
          <span>Sample company · not a live bid.</span>
          <span>
            {blockers.length} {blockers.length === 1 ? 'blocker' : 'blockers'}
          </span>
          <span>{signed ? 'Register signed off' : 'Register needs review'}</span>
        </div>
      </header>
      <section className="bid-next" aria-label="Next step">
        <div>
          <div className="eyebrow">NEXT STEP</div>
          <p>
            {!insuranceCurrent
              ? 'The insurance cited in this bid has expired.'
              : !signed
                ? 'Review each source and record your finding.'
                : currentDecision && decision?.value === 'no_bid'
                  ? 'No-bid is recorded. Reopen only after a new human review.'
                  : 'Keep the decision and response tied to the current evidence.'}
          </p>
        </div>
        <a className="button primary" href={`#${next[1]}`}>
          {next[0]}
        </a>
      </section>
      <details className="bid-more">
        <summary>More on this bid</summary>
        <nav>
          <a href="#bid-evidence">Passport evidence</a>
          <a href="#bid-tasks">Tasks</a>
          <a href="#bid-decision">Decision</a>
          <a href="#bid-outline">Outline / export</a>
          <a href="#bid-handoff">Submission handoff</a>
          <a href="#bid-amendments">Amendments</a>
        </nav>
        <p>
          Bid changes and confirmation records reset when you leave this page. Use made-up
          information only.
        </p>
      </details>
      {message && (
        <p role="status" className="info-note">
          {message}
        </p>
      )}
      <section className="panel" id="bid-register" aria-labelledby="register-title">
        <h2 id="register-title">Requirements register</h2>
        <p>
          Revision {revision} ·{' '}
          {signed ? 'Signed off by Alex · ' + signoff.at : 'Incomplete until signed off.'}
        </p>
        <p>
          Candidate requirements may be incomplete or inaccurate. Check the source text and linked
          evidence before recording a finding.
        </p>
        <details className="notice-candidates">
          <summary>Add requirements from notice text</summary>
          <p>Local text helper; no AI call. Review each quoted candidate before adding it.</p>
          <label>
            Page or section
            <input
              value={sourceLocation}
              maxLength={120}
              onChange={(e) => {
                setSourceLocation(e.target.value);
                setCandidates(undefined);
              }}
            />
          </label>
          <label>
            Public notice excerpt
            <textarea
              value={notice}
              maxLength={24000}
              onChange={(e) => {
                setNotice(e.target.value);
                setCandidates(undefined);
              }}
            />
          </label>
          <button
            className="button"
            disabled={!notice.trim() || !sourceLocation.trim()}
            onClick={() => {
              setCandidates(noticeCandidates(opportunity.title, sourceLocation, notice));
              setDismissed([]);
            }}
          >
            Find candidate requirements
          </button>
          {candidates && (
            <>
              <p>
                {candidates.candidates.length} candidate requirements; {candidates.omitted} long or
                excess lines omitted. Unmatched lines still need human review.
              </p>
              {candidates.candidates.map((c) => (
                <article key={c.line}>
                  <blockquote>{c.text}</blockquote>
                  <p>{c.citation}</p>
                  <button
                    className="button"
                    disabled={requirements.some((r) => r.text === c.text)}
                    onClick={() => {
                      setRequirements((rows) => [
                        ...rows,
                        {
                          title: `Notice line ${c.line}: ${c.text.slice(0, 70)}`,
                          text: c.text,
                          source: c.citation,
                          evidence: 'No Passport evidence linked',
                          status: 'needs_review',
                          note: '',
                        },
                      ]);
                      invalidate('Added a candidate requirement for human review.');
                    }}
                  >
                    Add candidate for review
                  </button>
                </article>
              ))}
              <h3>California checklist, not a determination</h3>
              <p>Rules version {californiaRulesVersion}</p>
              {californiaSuggestions(notice)
                .filter((s) => !dismissed.includes(s.id))
                .map((s) => (
                  <article key={s.id}>
                    <b>{s.category}</b>
                    <p>{s.explanation}</p>
                    <blockquote>{s.quote}</blockquote>
                    <p>Pasted line {s.line} · suggestion only</p>
                    <button
                      className="button"
                      onClick={() => setDismissed((old) => [...old, s.id])}
                    >
                      Dismiss {s.category} suggestion
                    </button>
                  </article>
                ))}
            </>
          )}
        </details>
        <div className="bid-evidence" id="bid-evidence">
          <b>Linked Passport: general liability insurance</b>
          <p>
            {insuranceCurrent
              ? 'Renewal attested by Alex. Review the policy against the requested endorsements.'
              : 'Expired September 1, 2026 · last checked September 25 by Alex.'}
          </p>
          <button
            className="button"
            onClick={() => {
              setInsuranceCurrent(!insuranceCurrent);
              setRequirements((rows) =>
                rows.map((r, i) => (i === 6 ? { ...r, status: 'needs_review', note: '' } : r)),
              );
              invalidate(
                insuranceCurrent
                  ? 'Insurance expired; linked requirement reopened.'
                  : 'Insurance renewed; linked requirement needs review.',
              );
            }}
          >
            {insuranceCurrent ? 'Simulate insurance expiration' : 'Simulate insurance renewal'}
          </button>
        </div>
        {requirements.map((r, i) => (
          <details className="requirement-row" key={r.title}>
            <summary>
              <span>
                {String(i + 1).padStart(2, '0')} · {r.title}
              </span>
              <span className={`requirement-status ${r.status}`}>
                {
                  {
                    needs_review: 'Needs review',
                    reviewed: 'Reviewed',
                    blocker: 'Blocker',
                    not_applicable: 'Not applicable',
                  }[r.status]
                }
              </span>
            </summary>
            <p>{r.text}</p>
            <p>
              <b>Source:</b> {r.source}
            </p>
            <p>
              <b>Linked Passport / record:</b>{' '}
              {i === 6 && insuranceCurrent
                ? 'Renewed general liability policy · attested by Alex'
                : r.evidence}
            </p>
            <p>
              Owner: {i === 2 || i === 6 ? 'Casey' : i === 3 || i === 8 ? 'Jordan' : 'Alex'} ·
              Review due: October 1, 2026 · America/Los_Angeles
            </p>
            <div className="bid-form-grid">
              <label>
                Review status for {r.title}
                <select
                  value={r.status}
                  onChange={(e) => {
                    const status = e.target.value as Review;
                    setRequirements((rows) =>
                      rows.map((row, index) => (index === i ? { ...row, status } : row)),
                    );
                    invalidate(`Changed ${r.title}.`);
                  }}
                >
                  <option value="needs_review">Needs review</option>
                  <option value="reviewed" disabled={i === 6 && !insuranceCurrent}>
                    Reviewed
                  </option>
                  <option value="blocker">Blocker</option>
                  <option value="not_applicable">Not applicable — reason required</option>
                </select>
              </label>
              <label>
                Review note for {r.title}
                <input
                  value={r.note}
                  maxLength={500}
                  onChange={(e) => {
                    setRequirements((rows) =>
                      rows.map((row, index) =>
                        index === i ? { ...row, note: e.target.value } : row,
                      ),
                    );
                    setRevision((n) => n + 1);
                    setHumanComplete(false);
                  }}
                />
              </label>
            </div>
          </details>
        ))}
        <p>
          {blockers.length} documented blockers. Every row needs a disposition and note; a blocker
          may remain for a no-bid decision.
        </p>
        <button
          className="button primary"
          disabled={!reviewed || signed}
          onClick={() => {
            setSignoff({ revision, at: new Date().toISOString() });
            log(`Alex signed off the register at revision ${revision}.`);
          }}
        >
          Sign off requirements register
        </button>
      </section>
      <section className="panel" id="bid-tasks">
        <h2>Tasks</h2>
        <p>
          {tasks.filter((t) => !t).length} open tasks · 3 owners ·{' '}
          {Math.max(
            0,
            Math.ceil(
              (Date.parse(opportunity.deadline) - Date.parse('2026-09-26T00:00:00-07:00')) /
                86400000,
            ),
          )}{' '}
          days to deadline as of September 26
        </p>
        {taskNames.map((name, i) => (
          <label className="checklist-row" key={name}>
            <input
              type="checkbox"
              checked={tasks[i]}
              onChange={() => {
                setTasks((old) => old.map((v, j) => (j === i ? !v : v)));
                setApproved(undefined);
              }}
            />
            {name}
          </label>
        ))}
      </section>
      <section className="panel" id="bid-decision">
        <h2>Decision</h2>
        <p>
          Decision:{' '}
          {decision
            ? `${currentDecision ? 'Current' : 'Stale'} ${decision.value === 'bid' ? 'bid' : 'no-bid'} — ${decision.reason}`
            : 'Not recorded'}
        </p>
        {decision && (
          <p>
            Alex · {decision.at} · source revision {decision.revision} · preserved blockers:{' '}
            {decision.blockers.join('; ') || 'None'}
          </p>
        )}
        <div className="bid-form-grid">
          <label>
            Reason code
            <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              {[
                'license',
                'bond',
                'capacity',
                'territory',
                'set_aside',
                'margin_unknown',
                'deadline',
                'site_visit',
                'relationship',
                'strategic',
                'other',
              ].map((code) => (
                <option key={code} value={code}>
                  {code.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estimated pursuit hours
            <input
              type="number"
              min="0"
              max="10000"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </label>
        </div>
        <label>
          Decision reason
          <input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="bid-actions">
          <button
            className="button"
            disabled={!signed || !reason.trim() || blockers.length > 0}
            onClick={() => recordDecision('bid')}
          >
            Record bid decision
          </button>
          <button
            className="button"
            disabled={!signed || !reason.trim()}
            onClick={() => recordDecision('no_bid')}
          >
            Record no-bid decision
          </button>
        </div>
      </section>
      <section className="panel" id="bid-outline">
        <h2>Response outline / export</h2>
        <p>
          Source-backed facts only. Technical approach, price and signatures remain human input.
          Demo exports a sample text document; signed-in responses support PDF and Word.
        </p>
        <button
          className="button"
          disabled={!signed || !currentDecision || decision?.value !== 'bid'}
          onClick={outline}
        >
          Create response outline
        </button>
        {version > 0 && (
          <>
            <label>
              Response draft
              <textarea
                aria-label="Response draft"
                rows={12}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setVersion((v) => v + 1);
                  setApproved(undefined);
                }}
              />
            </label>
            <p>
              Version {version} · source revision {draftRevision} ·{' '}
              {approvedCurrent ? 'Approved' : 'Unapproved or stale'}
            </p>
            <div className="bid-actions">
              <button className="button" onClick={exportDraft}>
                Export sample text
              </button>
              <button
                className="button"
                disabled={
                  !signed ||
                  !currentDecision ||
                  decision?.value !== 'bid' ||
                  draftRevision !== revision ||
                  !draft.trim() ||
                  draft.includes(placeholder) ||
                  !tasks.every(Boolean)
                }
                onClick={() => {
                  setApproved(version);
                  log(`Alex approved version ${version}, source revision ${revision}.`);
                }}
              >
                Approve this version
              </button>
            </div>
            <p>
              Approval requires current review, completed tasks and no human-input placeholders.
              Editing creates an unapproved version.
            </p>
          </>
        )}
      </section>
      <section className="panel" id="bid-handoff">
        <h2>Submission handoff</h2>
        <p>
          <strong>{ready ? 'Ready for human handoff' : 'Not ready for handoff'}</strong> · No files
          are sent to a buyer.
        </p>
        <ul>
          {gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
        <div className="bid-form-grid">
          <label>
            Named submitter
            <input
              value={submitter}
              maxLength={100}
              onChange={(e) => setSubmitter(e.target.value)}
              placeholder="Jordan (sample)"
            />
          </label>
          <label>
            Portal destination
            <input
              value={destination}
              maxLength={500}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Sample municipal PlanetBids portal"
            />
          </label>
          <label>
            Intended submit-by (America/Los_Angeles)
            <input
              type="datetime-local"
              value={intendedAt}
              onChange={(e) => setIntendedAt(e.target.value)}
            />
          </label>
        </div>
        <label className="checklist-row">
          <input
            type="checkbox"
            checked={humanComplete}
            onChange={(e) => {
              setHumanComplete(e.target.checked);
              log(
                e.target.checked
                  ? 'Alex confirmed price and representations are complete outside BidXchange.'
                  : 'External completion confirmation cleared.',
              );
            }}
          />
          Price and representations are complete outside BidXchange
        </label>
        <h3>Packet checklist</h3>
        <ul>
          {requirements.map((r, i) => (
            <li key={r.title}>
              {r.title} · {r.source} · {r.status.replaceAll('_', ' ')}
              {i === 6 ? (insuranceCurrent ? ' · renewal recorded' : ' · expired') : ''}
            </li>
          ))}
        </ul>
        <p>
          Addenda:{' '}
          {amendment
            ? `Amendment ${amendment} · ${acknowledged ? 'acknowledged by Alex at ' + acknowledged : 'not acknowledged'}`
            : 'None recorded; confirm against the source.'}
        </p>
        <PortalPlaybook portal="PlanetBids" demo />
        <h3 id="bid-submission">Record submission</h3>
        <p>
          User-entered; BidXchange does not verify buyer receipt. The named person submits
          externally.
        </p>
        <div className="bid-form-grid">
          <label>
            Actual submitted-at (America/Los_Angeles)
            <input
              type="datetime-local"
              value={submittedAt}
              onChange={(e) => setSubmittedAt(e.target.value)}
            />
          </label>
          <label>
            Confirmation number
            <input value={receipt} maxLength={100} onChange={(e) => setReceipt(e.target.value)} />
          </label>
        </div>
        <label>
          Acknowledgment note
          <textarea value={ackNote} maxLength={1000} onChange={(e) => setAckNote(e.target.value)} />
        </label>
        <button
          className="button"
          disabled={
            !ready ||
            !approvedCurrent ||
            !receipt.trim() ||
            !submittedAt ||
            !intendedAt ||
            !ackNote.trim()
          }
          onClick={() => {
            if (!ready || !approvedCurrent) return;
            setSubmitted({
              version,
              receipt: receipt.trim(),
              submitter,
              destination,
              intended: intendedAt,
              actual: submittedAt,
              note: ackNote,
              at: new Date().toISOString(),
            });
            log(
              `Alex recorded ${submitter}'s submission of version ${version}. Buyer receipt not independently verified.`,
            );
          }}
        >
          Record submission
        </button>
        {submitted && (
          <p>
            Historical user-recorded submission: version {submitted.version}, confirmation{' '}
            {submitted.receipt}. Submitter {submitted.submitter}; {submitted.destination}; intended{' '}
            {submitted.intended}; actual {submitted.actual} America/Los_Angeles. {submitted.note}{' '}
            Recorded by Alex at {submitted.at}. Buyer receipt not independently verified.
          </p>
        )}
      </section>
      <details className="panel" id="bid-amendments">
        <summary>Amendments and audit history</summary>
        <button
          className="button"
          onClick={() => {
            setAmendment((v) => v + 1);
            setAcknowledged(undefined);
            setRequirements((rows) =>
              rows.map((r) => ({ ...r, status: 'needs_review', note: '' })),
            );
            invalidate('Added amendment: revised instructions; all requirements reopened.');
          }}
        >
          Simulate an amendment
        </button>
        {amendment > 0 && (
          <label className="checklist-row">
            <input
              type="checkbox"
              checked={!!acknowledged}
              onChange={(e) => {
                setAcknowledged(e.target.checked ? new Date().toISOString() : undefined);
                invalidate(
                  e.target.checked
                    ? 'Alex acknowledged the amendment.'
                    : 'Amendment acknowledgment cleared.',
                );
              }}
            />
            Acknowledge Amendment {amendment}
          </label>
        )}
        <p>
          Amendments reopen the register and invalidate handoff. Previous decisions and submission
          records remain in history.
        </p>
        <ol>
          {history.map((event, i) => (
            <li key={i}>{event}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
