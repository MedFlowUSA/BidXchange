'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { evidenceStressTest } from '../lib/evidence-stress-test';

export default function EvidenceStressTest({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const [excluded, setExcluded] = useState<string[]>([]);
  const result = evidenceStressTest(data, pursuitId, excluded);
  if (!data.evidenceReviewsEnabled) return null;
  return (
    <section className="panel evidence-stress" aria-labelledby="evidence-stress-heading">
      <div className="eyebrow">Test the assumptions behind your bid</div>
      <h2 id="evidence-stress-heading">What if your evidence falls through?</h2>
      <p>
        A license lapses. A reference pulls out. Explore which requirements would lose reviewed
        support before it happens.
      </p>
      <details>
        <summary>Open evidence stress test</summary>
        <p>
          Temporary scenario using visible records as of {data.reviewAsOf}. Nothing is saved or
          sent. Refresh to check for changes.
        </p>
        {(result.partial || result.omitted) && (
          <p role="status">
            This scenario is incomplete: a record limit was reached or some linked evidence is not
            loaded.
          </p>
        )}
        <p>
          Other evidence may be outside your view. Remaining approvals are candidates for review,
          not guaranteed substitutes. This test does not change requirement findings, buyer waivers,
          or bid decisions.
        </p>
        {!result.choices.length ? (
          <p>
            No current evidence approvals with loaded evidence are available for this pursuit.
            Review evidence use in the requirement register to build the first connections.
          </p>
        ) : (
          <>
            <fieldset className="stress-choices">
              <legend>Assume these records become unusable</legend>
              {result.choices.map((choice) => (
                <label key={choice.id}>
                  <input
                    type="checkbox"
                    checked={excluded.includes(choice.id)}
                    onChange={(e) =>
                      setExcluded((current) =>
                        e.target.checked
                          ? [...current, choice.id]
                          : current.filter((id) => id !== choice.id),
                      )
                    }
                  />
                  <span>
                    {choice.label}
                    <small>
                      Reviewed support for {choice.count}{' '}
                      {choice.count === 1 ? 'requirement' : 'requirements'}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="stress-result" role="status" aria-live="polite" aria-atomic="true">
              {result.selectedCount
                ? `Affected requirements: ${result.affected.length}. Without other loaded, currently approved evidence in this scenario: ${result.withoutAlternative}.`
                : 'Select evidence to see where support would be lost.'}
            </div>
            {result.selectedCount > 0 && (
              <button type="button" onClick={() => setExcluded([])}>
                Reset scenario
              </button>
            )}
            <ul className="decision-brief-list">
              {result.affected.map(({ requirement, remaining }) => (
                <li key={requirement.id}>
                  <Link href={`#requirement-${requirement.id}`}>{requirement.requirement}</Link>
                  <p>
                    {remaining
                      ? `Other loaded evidence records with current approvals: ${remaining}. Confirm their scope with the reviewer.`
                      : 'No other loaded evidence retains a current approval. Ask the reviewer to confirm whether replacement support is needed.'}
                  </p>
                  <p>
                    {requirement.citation
                      ? `Notice: ${requirement.citation}`
                      : 'Add a notice citation.'}{' '}
                    {requirement.owner_user_id
                      ? 'Follow up with the assigned requirement owner.'
                      : 'Assign a requirement owner for follow-up.'}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
    </section>
  );
}
