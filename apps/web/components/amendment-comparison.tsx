'use client';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { saveComparison, confirmComparison } from '../app/amendment-comparison-actions';
import type { TenantData } from '../lib/tenant-types';
import type { SavedComparison, ComparisonReview } from '../lib/amendment-comparison';
import styles from './amendment-comparison.module.css';

function ComparisonCard({
  entry,
  review,
  org,
  context,
}: {
  entry: SavedComparison;
  review?: ComparisonReview;
  org: string;
  context: string;
}) {
  const [state, action, pending] = useActionState(confirmComparison, { message: '' });
  const stale = entry.context_token !== context;
  return (
    <details className={styles.card}>
      <summary>
        {entry.label} —{' '}
        {review
          ? review.outcome === 'confirmed'
            ? 'Amendment recorded'
            : 'Dismissed'
          : stale
            ? 'Source context changed'
            : 'Needs human review'}
      </summary>
      <p>
        Rule-generated candidate comparison · {entry.method} ·{' '}
        {new Date(entry.created_at).toLocaleString()}
      </p>
      <p>
        Matching clauses retain the original wording, including amounts and conditions. Missing
        clauses are unknown, not removed requirements. Unchanged excerpts do not prove an unchanged
        solicitation.
      </p>
      {entry.items.map((item) => (
        <section key={item.field} className={styles.field}>
          <h4>
            {item.label} —{' '}
            {item.status === 'unknown'
              ? 'Not found on one or both sides'
              : item.status === 'changed'
                ? 'Wording differs'
                : 'Matching wording'}
          </h4>
          <div className={styles.columns}>
            {(
              [
                ['Original', item.before],
                ['Amended', item.after],
              ] as const
            ).map(([name, clauses]) => (
              <div key={name}>
                <h5>{name} clause / value</h5>
                {!clauses.length && (
                  <p>Not found in the supplied excerpt. Check the complete source.</p>
                )}
                {clauses.map((c) => (
                  <blockquote key={c.line}>
                    <p>{c.text}</p>
                    <cite>Excerpt line {c.line}</cite>
                  </blockquote>
                ))}
              </div>
            ))}
          </div>
          <p>Suggested requirements to inspect (keyword matches only):</p>
          {item.suggestedRequirementIds.length ? (
            <ul>
              {item.suggestedRequirementIds.map((id) => {
                const r = entry.requirements.find((r) => r.id === id);
                return (
                  <li key={id}>
                    {r?.text ?? 'Requirement reference unavailable'} — saved status:{' '}
                    {r?.status ?? 'unknown'}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No keyword match. A person may still identify an affected requirement.</p>
          )}
        </section>
      ))}
      <details>
        <summary>Preserved source excerpts</summary>
        <div className={styles.columns}>
          <div>
            <a href={entry.original_url} target="_blank" rel="noopener noreferrer">
              Original official source · external
            </a>
            <pre>{entry.original_text}</pre>
          </div>
          <div>
            <a href={entry.amended_url} target="_blank" rel="noopener noreferrer">
              Amended official source · external
            </a>
            <pre>{entry.amended_text}</pre>
          </div>
        </div>
      </details>
      {review ? (
        <div>
          <p>Human review: {review.note}</p>
          <p>
            Recorded {new Date(review.reviewed_at).toLocaleString()} by {review.reviewed_by}.
          </p>
          {review.outcome === 'confirmed' && (
            <p>
              Review the recorded amendment below, then review requirements and sign off the
              register separately. This does not update deadlines or approve evidence.
            </p>
          )}
        </div>
      ) : (
        <form
          action={action}
          className={styles.form}
          aria-label={'Review comparison ' + entry.label}
        >
          <input type="hidden" name="organization_id" value={org} />
          <input type="hidden" name="comparison_id" value={entry.id} />
          <fieldset disabled={pending || state.success}>
            <legend>Human findings</legend>
            {stale && (
              <p role="status">
                Records changed since this comparison. Create a new comparison before confirming.
                You may still dismiss this one.
              </p>
            )}
            <label>
              Review outcome
              <select name="outcome" required defaultValue="">
                <option value="" disabled>
                  Choose after reviewing
                </option>
                <option value="confirmed" disabled={stale}>
                  Record official amendment
                </option>
                <option value="dismissed">Dismiss comparison</option>
              </select>
            </label>
            <fieldset>
              <legend>Requirements you identified as affected</legend>
              {entry.requirements.map((r) => (
                <label key={r.id}>
                  <input type="checkbox" name="affected" value={r.id} />
                  {r.text}
                </label>
              ))}
            </fieldset>
            <label>
              Findings, corrections and source references
              <textarea name="note" required maxLength={4000} />
            </label>
            <p>
              Recording an amendment marks ALL requirements for this opportunity as needing review,
              including previously reviewed evidence findings. Your selections document specific
              impacts; they do not limit that safeguard. Previous sign-off and final decision
              context become stale. Dates, pricing and requirement wording are not changed
              automatically.
            </p>
            <label>
              <input type="checkbox" name="acknowledged" required />I reviewed the official source
              and understand this impact. The recorded amendment excerpt and my findings will be
              shared with company members.
            </label>
            <button className="button primary">{pending ? 'Saving…' : 'Save human review'}</button>
          </fieldset>
          <p role="status">{state.message}</p>
        </form>
      )}
    </details>
  );
}
export default function AmendmentComparison({
  data,
  opportunityId,
}: {
  data: TenantData;
  opportunityId: string;
}) {
  const [state, action, pending] = useActionState(saveComparison, { message: '' });
  const router = useRouter(),
    workspace = data.amendmentComparisons;
  if (!workspace) return null;
  return (
    <section className={styles.workspace} aria-label="Compare solicitation amendments">
      <h3>Compare the original notice and amendment</h3>
      <p>
        Find changes before you revise the register. Paste public excerpts from both versions;
        linked pages are not fetched. This rule-based tool is not an AI or legal interpretation and
        may miss clauses, tables and cross-references.
      </p>
      {workspace.issue ? (
        <p role="alert">{workspace.issue}</p>
      ) : (
        <>
          <details className={styles.card}>
            <summary>Create amendment comparison</summary>
            <form action={action} className={styles.form} aria-label="Create amendment comparison">
              <input type="hidden" name="organization_id" value={data.organization.id} />
              <input type="hidden" name="opportunity_id" value={opportunityId} />
              <input type="hidden" name="context" value={workspace.context} />
              <fieldset disabled={pending || state.success}>
                <legend>Public source versions</legend>
                <label>
                  Comparison / amendment label
                  <input name="label" required maxLength={200} />
                </label>
                <div className={styles.columns}>
                  {(['original', 'amended'] as const).map((kind) => (
                    <div key={kind}>
                      <label>
                        {kind === 'original' ? 'Original official URL' : 'Amended official URL'}
                        <input type="url" name={kind + '_url'} required maxLength={2000} />
                      </label>
                      <label>
                        {kind === 'original' ? 'Original public excerpt' : 'Amended public excerpt'}
                        <textarea name={kind + '_text'} required maxLength={24000} rows={9} />
                      </label>
                    </div>
                  ))}
                </div>
                <p>
                  Use one clause per line when practical. Include surrounding conditions. Do not
                  paste company financial information or private documents. Up to 24,000 characters
                  per excerpt and 200 linked requirements.
                </p>
                <label>
                  <input type="checkbox" name="public_source" required />
                  Both excerpts are public solicitation text. I will review the generated comparison
                  against the complete official sources.
                </label>
                <button className="button primary">
                  {pending ? 'Comparing…' : 'Save candidate comparison'}
                </button>
              </fieldset>
              <p role="status">{state.message}</p>
              {state.success && (
                <button type="button" className="button secondary" onClick={() => router.refresh()}>
                  Refresh comparisons
                </button>
              )}
            </form>
          </details>
          <p>
            Latest five saved comparisons. Full source snapshots and review history are retained.
          </p>
          {!workspace.entries.length && (
            <p>
              No comparisons yet. Start with the original excerpt and the buyer’s amended text;
              saving a comparison does not change your register.
            </p>
          )}
          {workspace.entries.map((entry) => (
            <ComparisonCard
              key={entry.id}
              entry={entry}
              review={workspace.reviews.find((r) => r.comparison_id === entry.id)}
              org={data.organization.id}
              context={workspace.context}
            />
          ))}
        </>
      )}
    </section>
  );
}
