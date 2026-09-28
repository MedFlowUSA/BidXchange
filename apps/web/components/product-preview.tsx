'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardList } from 'lucide-react';
import styles from './bid-preview.module.css';

const steps = ['Company records', 'Bid requirements', 'Open work', 'Reviewed draft'] as const;
const requirements = [
  {
    name: 'License requirement',
    status: 'Needs human review',
    quote: 'Contractor must hold the license classification required for the electrical scope.',
    record: 'A CSLB record is saved in the sample company profile.',
    question:
      'Does the recorded classification cover the work described in the full specification?',
    task: 'Bid lead: compare the classification with the specification and official license record.',
  },
  {
    name: 'Bond confirmation',
    status: 'Needs evidence',
    quote: 'Provide a bid bond with the response.',
    record: 'Bonding information is saved; confirmation for this bid is missing.',
    question: 'Has the surety confirmed the bond required for this specific bid?',
    task: 'Estimator: request written confirmation from the surety before the response review.',
  },
  {
    name: 'Mandatory job walk',
    status: 'Needs clarification',
    quote: 'Attendance at the pre-bid site walk is mandatory.',
    record: 'A job-walk task exists; attendance has not been confirmed.',
    question: 'Who will attend, and has the team checked the notice for the meeting details?',
    task: 'Project manager: confirm the date, location and attendee; record attendance after the walk.',
  },
] as const;

export default function ProductPreview() {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(1);
  const [change, setChange] = useState<'none' | 'amendment' | 'insurance'>('none');
  const requirement = requirements[selected];
  return (
    <figure
      id="sample-review"
      className={styles.brief}
      aria-label="Interactive bid review using fictional Apex Energy Demo records"
    >
      <div className={styles.top}>
        <span>
          <ClipboardList size={15} aria-hidden="true" /> TRY THE REVIEW
        </span>
        <span>FICTIONAL EXAMPLE</span>
      </div>
      <div className={styles.heading}>
        <p>APEX ENERGY DEMO · MUNICIPAL PUBLIC WORKS</p>
        <h2>Municipal building energy retrofit</h2>
        <span>Select a step to see how the records connect.</span>
      </div>
      <div id="workflow" className={styles.steps} role="group" aria-label="Sample bid workflow">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={step === index}
            aria-controls="sample-step"
            onClick={() => setStep(index)}
          >
            <span aria-hidden="true">0{index + 1}</span>
            {label}
          </button>
        ))}
      </div>
      <div
        id="sample-step"
        className={styles.sheet}
        role="region"
        aria-label={steps[step]}
        aria-live="polite"
        aria-atomic="true"
      >
        {step === 0 && (
          <>
            <h3>Start with the company profile.</h3>
            <p>Keep the source, last-checked date and review status with each record.</p>
            <ul className={styles.records}>
              <li>
                <strong>CSLB and DIR records</strong>
                <span>Saved for review against this notice</span>
              </li>
              <li>
                <strong>Insurance</strong>
                <span>Expiration dates recorded</span>
              </li>
              <li>
                <strong>Bonding information</strong>
                <span>Bid-specific surety confirmation missing</span>
              </li>
            </ul>
            <Link href="/company?workspace=demo">
              View sample company profile <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </>
        )}
        {step === 1 && (
          <>
            <div className={styles.choices} role="group" aria-label="Sample requirements">
              {requirements.map((item, index) => (
                <button
                  type="button"
                  key={item.name}
                  aria-pressed={selected === index}
                  aria-controls="sample-requirement"
                  onClick={() => setSelected(index)}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <div id="sample-requirement">
              <span className={styles.status}>{requirement.status}</span>
              <h3>{requirement.name}</h3>
              <dl className={styles.comparison}>
                <div>
                  <dt>Sample notice says</dt>
                  <dd>“{requirement.quote}”</dd>
                </div>
                <div>
                  <dt>Company record</dt>
                  <dd>{requirement.record}</dd>
                </div>
                <div>
                  <dt>Still to check</dt>
                  <dd>{requirement.question}</dd>
                </div>
              </dl>
              <p className={styles.next}>
                <strong>Next task</strong>
                {requirement.task}
              </p>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h3>Give each follow-up an owner.</h3>
            <ul className={styles.records}>
              <li>
                <strong>Estimator · Request bond confirmation</strong>
                <span>Open · before response review</span>
              </li>
              <li>
                <strong>Project manager · Confirm job-walk attendee</strong>
                <span>Open · check the notice for the date</span>
              </li>
              <li>
                <strong>Bid lead · Review license classification</strong>
                <span>Open · before final bid/no-bid decision</span>
              </li>
            </ul>
            <p>
              Completing a task does not approve a requirement. Review and sign off the register,
              then record the final bid/no-bid decision.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <span className={styles.status}>Sample draft · not approved</span>
            <h3>Prepare the draft for a person to review.</h3>
            <p>Reuse current, attested company details. Keep missing answers visible.</p>
            <ul className={styles.records}>
              <li>
                <strong>Company identity</strong>
                <span>Apex Energy Demo · fictional</span>
              </li>
              <li>
                <strong>Technical approach and pricing</strong>
                <span>[HUMAN INPUT REQUIRED]</span>
              </li>
              <li>
                <strong>Bond confirmation and job walk</strong>
                <span>Unresolved · follow-up required</span>
              </li>
            </ul>
            <p>
              Export a PDF or Word draft. An authorized person approves a specific version; your
              team submits externally and records the confirmation.
            </p>
          </>
        )}
      </div>
      <details className={styles.changes}>
        <summary>What if the notice or insurance changes?</summary>
        <p>
          Try a separate, later-stage scenario with a previously reviewed requirement and final
          decision.
        </p>
        <div role="group" aria-label="Sample change scenarios">
          <button
            type="button"
            aria-pressed={change === 'amendment'}
            onClick={() => setChange('amendment')}
          >
            Recorded amendment
          </button>
          <button
            type="button"
            aria-pressed={change === 'insurance'}
            onClick={() => setChange('insurance')}
          >
            Expired insurance
          </button>
          <button type="button" onClick={() => setChange('none')}>
            Reset example
          </button>
        </div>
        <p role="status">
          {change === 'none'
            ? 'Choose a change to see why a previous review needs attention.'
            : change === 'amendment'
              ? 'Before: reviewed requirement and final decision. After an amendment is recorded: register sign-off is cleared, requirements need re-review and the decision is stale. The bid lead reviews the change before reaffirming.'
              : 'Before: reviewed requirement linked to current insurance. After that evidence expires: the linked requirement needs review and the decision is stale. Request renewed evidence, review it and reaffirm the decision.'}
        </p>
        <p>Previous decisions remain in the history. No automatic no-bid decision or approval.</p>
      </details>
      <div className={styles.decision}>
        <Link href="/pursuits/DEMO-001?workspace=demo">
          Open the full demo <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <figcaption>
        Fictional demonstration data and illustrative clauses. Nothing is saved. BidXchange does not
        determine eligibility or submit bids for you.
      </figcaption>
    </figure>
  );
}
