'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { reviewDecisionMemory } from '../app/decision-memory-actions';
import {
  matchLabel,
  reasonLabel,
  requirementFinding,
  reviewStatus,
  type MemoryEntry,
  type MemoryReview,
} from '../lib/decision-memory';
import type { TenantData } from '../lib/tenant-types';
import { workspaceHref } from '../lib/routes';
import styles from './decision-memory.module.css';

function Assessment({
  data,
  entry,
  reason,
  review,
}: {
  data: TenantData;
  entry: MemoryEntry;
  reason: string;
  review?: MemoryReview;
}) {
  const [state, action, pending] = useActionState(reviewDecisionMemory, { message: '' });
  const router = useRouter();
  const memory = data.decisionMemory!;
  return (
    <details className={styles.review}>
      <summary>
        {reasonLabel(reason)} — {reviewStatus(review, memory.context)}
      </summary>
      {review && (
        <div>
          <p>
            Last human assessment: {review.assessment.replaceAll('_', ' ')} ·{' '}
            {new Date(review.reviewed_at).toLocaleDateString()}
            {' · Reviewer: '}
            {review.reviewed_by === data.userId ? 'you' : review.reviewed_by}
          </p>
          <p>{review.note}</p>
          <p>Source / reference: {review.source_reference}</p>
          {review.context_token !== memory.context && (
            <p>
              Company records, notice details or review context changed. Reassess before relying on
              this finding.
            </p>
          )}
        </div>
      )}
      {['organization_admin', 'executive_approver'].includes(data.organization.role) &&
        memory.context && (
          <form action={action} className={styles.form}>
            <input type="hidden" name="organization_id" value={data.organization.id} />
            <input type="hidden" name="decision_id" value={entry.id} />
            <input type="hidden" name="opportunity_id" value={memory.opportunityId} />
            <input type="hidden" name="reason_code" value={reason} />
            <input type="hidden" name="context" value={memory.context} />
            <input type="hidden" name="previous" value={review?.id ?? ''} />
            <fieldset disabled={pending || state.success}>
              <legend>Human assessment for this new notice</legend>
              <label>
                Current status
                <select name="assessment" aria-label="Current status" required defaultValue="">
                  <option value="" disabled>
                    Choose after reviewing
                  </option>
                  <option value="resolved">Resolved for this notice</option>
                  <option value="still_unresolved">Still unresolved</option>
                  <option value="not_applicable">Does not apply to this notice</option>
                </select>
              </label>
              <label>
                What did you check?
                <textarea name="note" required maxLength={2000} />
              </label>
              <label>
                Supporting record or source reference
                <input name="source_reference" required maxLength={1000} />
              </label>
              <p>
                These notes are shared with company members. Reference restricted records without
                copying their private values.
              </p>
              <label>
                <input type="checkbox" name="acknowledged" required /> I reviewed this reason
                against the new notice. This does not approve a requirement or a bid.
              </label>
              <button className="button primary">
                {pending ? 'Recording…' : 'Record human assessment'}
              </button>
            </fieldset>
            <p role="status">{state.message}</p>
            {state.success && (
              <button type="button" className="button secondary" onClick={() => router.refresh()}>
                Refresh assessments
              </button>
            )}
          </form>
        )}
    </details>
  );
}
export default function DecisionMemoryPanel({ data }: { data: TenantData }) {
  const memory = data.decisionMemory;
  if (!memory) return null;
  const matching = !!memory.opportunityId;
  const pageLink = (page: number) =>
    workspaceHref('/company', data.organization.id) +
    `&decision_page=${page}&decision_query=${encodeURIComponent(memory.query ?? '')}#company-decisions`;
  return (
    <section
      className={`panel ${styles.panel}`}
      aria-label={matching ? 'Similar past no-bid decisions' : 'Company Decision Log'}
    >
      <h2>{matching ? 'What your past no-bids can tell you' : 'Company Decision Log'}</h2>
      <p>
        {matching
          ? 'Source-text matches suggest earlier decisions to review. They do not establish that the bids have equivalent requirements or that a past gap is resolved.'
          : 'Keep the reasons you passed on work, and the requirements as they stood at the time. Closing a pursuit does not erase this history.'}
      </p>
      {!matching && (
        <form action="/company#company-decisions" className={styles.search}>
          <input type="hidden" name="organization" value={data.organization.id} />
          <label>
            Search agency, notice title or rationale
            <input name="decision_query" maxLength={80} defaultValue={memory.query ?? ''} />
          </label>
          <button className="button secondary">Search history</button>
        </form>
      )}
      {memory.issue ? (
        <p role="alert">{memory.issue}</p>
      ) : !memory.entries.length ? (
        <p>
          {matching
            ? 'No similar no-bid decisions were found in the recorded matching data. Review this notice on its own merits; older decisions may lack matching details.'
            : 'No no-bid decisions found. Record a human no-bid decision from a pursuit after signing off its Requirements Register; its reasons and snapshot will appear here.'}
        </p>
      ) : (
        memory.entries.map((entry) => (
          <article key={entry.id} className={styles.card}>
            <h3>{entry.opportunity_snapshot?.title ?? 'Historical notice details unavailable'}</h3>
            <p>
              You recorded a no-bid for{' '}
              {entry.opportunity_snapshot?.buyer || 'an unspecified agency'} on{' '}
              {new Date(entry.decided_at).toLocaleDateString()}.
            </p>
            <p>
              <strong>Reasons:</strong>{' '}
              {entry.reason_codes.length
                ? entry.reason_codes.map(reasonLabel).join(', ')
                : 'Structured reasons not recorded'}
            </p>
            <p>{entry.reason}</p>
            {matching && (
              <div>
                <p>Rule-based suggestion · {entry.match_version}</p>
                <ul>
                  {entry.matched_features?.map((f) => (
                    <li key={f}>{matchLabel(f)}</li>
                  ))}
                </ul>
              </div>
            )}
            <Link href={workspaceHref('/pursuits/' + entry.pursuit_id, data.organization.id)}>
              Open original pursuit and decision history →
            </Link>
            <details>
              <summary>Requirements at decision time</summary>
              <p>
                This historical snapshot is unchanged by later edits. “Support not confirmed” is not
                a finding of ineligibility.
              </p>
              {entry.review_snapshot?.requirements?.length ? (
                <ul>
                  {entry.review_snapshot.requirements.map((r) => (
                    <li key={r.id}>
                      <strong>{requirementFinding(r)}:</strong> {r.text}
                      <p>Source: {r.citation || 'Not recorded'}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Historical requirement detail unavailable.</p>
              )}
            </details>
            {matching &&
              entry.reason_codes.map((reason) => (
                <Assessment
                  key={
                    entry.id +
                    reason +
                    memory.context +
                    memory.reviews.find(
                      (r) => r.decision_id === entry.id && r.reason_code === reason,
                    )?.id
                  }
                  data={data}
                  entry={entry}
                  reason={reason}
                  review={memory.reviews.find(
                    (r) => r.decision_id === entry.id && r.reason_code === reason,
                  )}
                />
              ))}
          </article>
        ))
      )}
      {!matching && !memory.issue && (
        <nav className={styles.search} aria-label="Decision history pages">
          {!!memory.page && (
            <Link className="button secondary" href={pageLink(memory.page - 1)}>
              Previous decisions
            </Link>
          )}
          {memory.hasMore && (
            <Link className="button secondary" href={pageLink((memory.page ?? 0) + 1)}>
              Older decisions
            </Link>
          )}
          <p>Page {(memory.page ?? 0) + 1} · up to 25 decisions per page</p>
        </nav>
      )}
      {matching && (
        <Link href={workspaceHref('/company', data.organization.id) + '#company-decisions'}>
          View company decision history →
        </Link>
      )}
    </section>
  );
}
