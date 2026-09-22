'use client';

import { useState } from 'react';
import type { Opportunity } from '../lib/demo';

type Review = 'needs_review' | 'reviewed' | 'blocker' | 'not_applicable';
const initialRequirements = [
  [
    'License classification',
    'Have a person compare the electrical scope with the claimed CSLB classifications.',
    'Training notice §2',
    'CSLB: DEMO-ONLY · B / C-10; fictional attestation by Alex',
  ],
  [
    'DIR registration',
    'Review the claimed public-works registration.',
    'Training notice §2.1',
    'DIR: DEMO-ONLY; fictional source check',
  ],
  [
    'Bid bond',
    'Confirm a bid bond and available capacity with the surety.',
    'Training notice §3',
    'Single-project band $1M–$2M; aggregate availability unresolved',
  ],
  [
    'Mandatory job walk',
    'Assign attendance and record the instructions.',
    'Training notice §4',
    'Meeting task owned by Jordan',
  ],
  [
    'Prevailing wage',
    'Review the wage determination and applicable instructions.',
    'Training notice §5',
    'Claimed public-works experience; human review required',
  ],
  [
    'Certified payroll',
    'Confirm the payroll process and responsible person.',
    'Training notice §5.1',
    'Payroll process note owned by Alex',
  ],
  [
    'General liability insurance',
    'Review the policy dates and requested endorsements.',
    'Training notice §6',
    'Fictional policy; starts expired in this exercise',
  ],
  [
    'Relevant experience',
    'Choose only projects permitted for disclosure.',
    'Training notice §7',
    'Three fictional lighting/controls projects, 2023–2025; disclosure permitted in this exercise',
  ],
  [
    'Submission instructions',
    'Confirm the external destination, deadline and time zone.',
    'Training notice §8',
    'Training portal only; do not send anything',
  ],
  [
    'Addendum acknowledgment',
    'Check for changes before approving a response.',
    'Training notice §9',
    'No amendment simulated yet',
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

/** Fictional local exercise only. Production mutations remain in authenticated server actions. */
export default function DemoBidRehearsal({ opportunity }: { opportunity: Opportunity }) {
  const [requirements, setRequirements] = useState(initialRequirements);
  const [revision, setRevision] = useState(1);
  const [insuranceCurrent, setInsuranceCurrent] = useState(false);
  const [signoff, setSignoff] = useState<number>();
  const [decision, setDecision] = useState<{
    value: 'bid' | 'no_bid';
    revision: number;
    reason: string;
  }>();
  const [reason, setReason] = useState('');
  const [draft, setDraft] = useState('');
  const [version, setVersion] = useState(0);
  const [draftRevision, setDraftRevision] = useState(0);
  const [approved, setApproved] = useState<number>();
  const [receipt, setReceipt] = useState('');
  const [submitted, setSubmitted] = useState<{ version: number; receipt: string }>();
  const [history, setHistory] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [tasks, setTasks] = useState([false, false, false]);
  const currentDecision = decision?.revision === revision;
  const reviewed = requirements.every((r) => r.status !== 'needs_review' && r.note.trim());
  const blockers = requirements.filter((r) => r.status === 'blocker').length;
  const signed = signoff === revision;
  const approvedCurrent = approved === version && version > 0 && draftRevision === revision;
  function log(text: string) {
    setHistory((old) => [...old, text]);
    setMessage(text);
  }
  function invalidate(text: string) {
    setRevision((r) => r + 1);
    log(
      text +
        ' Register sign-off, decision and draft approval require renewed review. Previous history is preserved.',
    );
  }
  function recordDecision(value: 'bid' | 'no_bid') {
    if (!signed || !reason.trim()) return;
    setDecision({ value, revision, reason: reason.trim() });
    setApproved(undefined);
    log(
      `Alex (fictional approver) recorded ${value === 'bid' ? 'bid' : 'no-bid'} for revision ${revision}: ${reason.trim()}`,
    );
  }
  function outline() {
    setDraft(
      `FICTIONAL TRAINING RESPONSE — DO NOT SUBMIT\n${opportunity.title}\nApex Energy Demo · Redlands, CA\n${requirements.map((r) => `${r.title}: ${r.status === 'reviewed' ? r.evidence : placeholder}`).join('\n')}\nTechnical approach: ${placeholder}\nPricing: ${placeholder}\nSignature: ${placeholder}`,
    );
    setVersion((v) => v + 1);
    setDraftRevision(revision);
    setApproved(undefined);
    log('Created an unapproved training outline with visible human-input placeholders.');
  }
  function exportDraft() {
    const url = URL.createObjectURL(
      new Blob(
        [
          draft +
            '\n\nFictional exercise only. Human review required. BidXchange does not submit bids.',
        ],
        { type: 'text/plain' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `fictional-response-v${version}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel" aria-labelledby="rehearsal-title">
      <h2 id="rehearsal-title">Practice one bid from review to submission record</h2>
      <p>
        <strong>Fictional local exercise.</strong> Nothing is submitted or saved to a company. Use
        only made-up information. Changes reset when you leave or reload this page. Production
        controls depend on your role.
      </p>
      <p>
        Sample notice: {opportunity.title} · {opportunity.timezone}. Requirements below are training
        examples, not extracted from a real solicitation.
      </p>
      <p role="status">
        {message || 'Start by reviewing the evidence and resolving the sample bonding question.'}
      </p>
      <h3>1. Passport evidence and freshness</h3>
      <p>
        Apex Energy Demo · Redlands, California · San Bernardino and Riverside counties · electrical
        and energy-efficiency services. All identifiers, sources and attestations are fictional.
      </p>
      <p>
        Insurance:{' '}
        <strong>{insuranceCurrent ? 'Current in this exercise' : 'Expired — needs review'}</strong>
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
              ? 'Simulated insurance expiration; linked requirement reopened.'
              : 'Simulated renewal; review the linked requirement again.',
          );
        }}
      >
        {insuranceCurrent ? 'Simulate insurance expiration' : 'Simulate insurance renewal'}
      </button>
      <h3>2. Requirements Register · revision {revision}</h3>
      <p>
        Candidate requirements may be incomplete or inaccurate until a person reviews and signs off
        on the Requirements Register. Review all ten examples, including the source and evidence.
        Explain each disposition.
      </p>
      {requirements.map((r, i) => (
        <details className="panel" key={r.title}>
          <summary>
            {r.title} — {r.status.replaceAll('_', ' ')}
          </summary>
          <p>{r.text}</p>
          <p>
            Source: {r.source} · {r.evidence}
          </p>
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
                Reviewed for this exercise
              </option>
              <option value="blocker">Human-confirmed blocker</option>
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
                  rows.map((row, index) => (index === i ? { ...row, note: e.target.value } : row)),
                );
                setRevision((n) => n + 1);
              }}
            />
          </label>
        </details>
      ))}
      <p>
        {blockers} recorded blockers. Sign-off records review, not eligibility; blockers can remain
        documented for a no-bid decision.
      </p>
      <button
        className="button"
        disabled={!reviewed}
        onClick={() => {
          setSignoff(revision);
          log(`Alex signed off the fictional register at revision ${revision}.`);
        }}
      >
        Sign off training register
      </button>
      <p>Register: {signed ? 'Human sign-off current' : 'Human sign-off required'}</p>
      <h3>3. Human decision</h3>
      <label>
        Decision reason
        <input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </label>
      <button
        className="button"
        disabled={!signed || !reason.trim() || blockers > 0}
        onClick={() => recordDecision('bid')}
      >
        Record training bid
      </button>{' '}
      <button
        className="button"
        disabled={!signed || !reason.trim()}
        onClick={() => recordDecision('no_bid')}
      >
        Record training no-bid
      </button>
      <p>
        Decision:{' '}
        {decision
          ? `${currentDecision ? 'Current' : 'Stale'} ${decision.value === 'bid' ? 'bid' : 'no-bid'} — ${decision.reason}`
          : 'Not recorded'}
      </p>
      <h3>4. Assigned tasks</h3>
      {[
        'Jordan: attend the mandatory job walk',
        'Casey: confirm bond and insurance instructions',
        'Alex: review addenda and external submission instructions',
      ].map((task, i) => (
        <label className="checklist-row" key={task}>
          <input
            type="checkbox"
            checked={tasks[i]}
            onChange={() => {
              setTasks((old) => old.map((v, j) => (j === i ? !v : v)));
              setApproved(undefined);
            }}
          />
          {task}
        </label>
      ))}
      <h3>5. Response outline and version approval</h3>
      <p>
        Real response exports use the authenticated workflow. This rehearsal downloads a clearly
        labeled text example. Human placeholders must be replaced with fictional practice text
        before simulated approval.
      </p>
      <button
        className="button"
        disabled={!signed || !currentDecision || decision?.value !== 'bid'}
        onClick={outline}
      >
        Create training outline
      </button>
      {version > 0 && (
        <>
          <label>
            Training response
            <textarea
              aria-label="Training response"
              rows={10}
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
            {approvedCurrent ? 'Approved in this exercise' : 'Unapproved or stale'}
          </p>
          <button className="button" onClick={exportDraft}>
            Export training text
          </button>{' '}
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
              log(`Alex approved fictional version ${version}, source revision ${revision}.`);
            }}
          >
            Approve training version
          </button>
          <p>
            Approval requires a current bid decision, completed training tasks and no remaining
            placeholders. Editing creates an unapproved version.
          </p>
        </>
      )}
      <h3>6. User-recorded submission</h3>
      <p>
        A person submits externally. This exercise only records a fictional confirmation; no portal
        is contacted.
      </p>
      <label>
        Fictional confirmation number
        <input value={receipt} maxLength={100} onChange={(e) => setReceipt(e.target.value)} />
      </label>
      <button
        className="button"
        disabled={
          !approvedCurrent ||
          !signed ||
          !currentDecision ||
          decision?.value !== 'bid' ||
          !receipt.trim()
        }
        onClick={() => {
          setSubmitted({ version, receipt: receipt.trim() });
          log(
            `Jordan (fictional submitter) recorded submission of version ${version}; confirmation ${receipt.trim()}. Not independently verified by BidXchange.`,
          );
        }}
      >
        Record fictional submission
      </button>
      {submitted && (
        <p>
          Historical user-recorded submission: version {submitted.version}, confirmation{' '}
          {submitted.receipt}. Not independently verified by BidXchange. Later edits do not change
          this historical record.
        </p>
      )}
      <h3>7. Practice a change after review</h3>
      <button
        className="button"
        onClick={() => {
          setRequirements((rows) => rows.map((r) => ({ ...r, status: 'needs_review', note: '' })));
          invalidate(
            'Added fictional Amendment 1: revised instructions; all training requirements reopened.',
          );
        }}
      >
        Simulate an amendment
      </button>
      <p>
        Try an amendment or insurance expiration after a decision. Re-review, sign off again and
        create a new response version. Prior decisions, approvals and submission records remain in
        history.
      </p>
      <details>
        <summary>Exercise history ({history.length} events)</summary>
        <ol>
          {history.map((event, i) => (
            <li key={i}>{event}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
