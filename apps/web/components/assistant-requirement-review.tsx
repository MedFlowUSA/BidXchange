'use client';
import type { Answer, RequirementExcerpt } from '../lib/ai/contracts';
import type { TenantData } from '../lib/tenant-types';
import { reviewExcerptLimit, reviewTotalLimit } from '../lib/ai/requirement-sharing';
import styles from './assistant.module.css';

export function RequirementReviewSelection({
  requirements,
  selected,
  confirmed,
  disabled,
  onChange,
  onQuestion,
}: {
  requirements: NonNullable<TenantData['requirements']>;
  selected: RequirementExcerpt[];
  confirmed: boolean;
  disabled: boolean;
  onChange: (items: RequirementExcerpt[], confirmed?: boolean) => void;
  onQuestion: () => void;
}) {
  const total = selected.reduce((sum, item) => sum + item.text.length, 0);
  return (
    <fieldset className={styles.planCard} disabled={disabled}>
      <legend>Review bid requirements together</legend>
      <p>
        Select up to eight requirements for a source-linked comparison with company records. Only
        the excerpts you preview and authorize are shared. This does not review the entire
        solicitation.
      </p>
      <p aria-live="polite">
        {selected.length} of {requirements.length} loaded requirements selected ·{' '}
        {total.toLocaleString()} of {reviewTotalLimit.toLocaleString()} characters
      </p>
      <details>
        <summary>Choose requirements and preview shared text</summary>
        {requirements.map((r, index) => {
          const checked = selected.some((item) => item.id === r.id);
          const text = r.requirement.slice(0, reviewExcerptLimit);
          return (
            <div key={r.id} className={styles.reviewItem}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={
                    !checked &&
                    (selected.length >= 8 || total + text.length > reviewTotalLimit || !text.trim())
                  }
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [
                            ...selected,
                            {
                              id: r.id,
                              updatedAt: r.updated_at,
                              consent: true,
                              text,
                              truncated: r.requirement.length > reviewExcerptLimit,
                            },
                          ]
                        : selected.filter((item) => item.id !== r.id),
                    )
                  }
                />{' '}
                Requirement {index + 1}: {r.requirement.slice(0, 100)}
              </label>
              {checked && (
                <>
                  <blockquote>{text}</blockquote>
                  {r.requirement.length > reviewExcerptLimit && (
                    <p>
                      Excerpt truncated at {reviewExcerptLimit.toLocaleString()} characters. Later
                      conditions are not included.
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </details>
      {selected.length > 0 && (
        <>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => onChange(selected, event.target.checked)}
            />{' '}
            I reviewed the selected excerpts and am authorized to share them with AI for this
            conversation.
          </label>
          <p>
            Exclude confidential or restricted text. Changing the selection clears this conversation
            and requires confirmation again. Previously sent text cannot be unsent. No requirement
            status changes.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={!confirmed}
            onClick={onQuestion}
          >
            Use bid review question
          </button>
          <button type="button" className="button secondary" onClick={() => onChange([])}>
            Clear selected requirements
          </button>
        </>
      )}
    </fieldset>
  );
}

export function RequirementReviewResult({ answer }: { answer: Answer }) {
  if (!answer.requirementReview || !answer.sharedRequirements) return null;
  const labels = {
    records_found: 'Related records found — human review needed',
    needs_evidence: 'Supporting evidence needs follow-up',
    needs_clarification: 'Clarification needed',
  };
  const link = (key: string, label?: string) => {
    const citation = answer.citations.find((item) => item.key === key);
    return citation?.href ? (
      <a key={key} href={citation.href}>
        {label ?? citation.title}
      </a>
    ) : null;
  };
  return (
    <section className={styles.taskPlan} aria-label="Selected requirement review">
      <h3>Selected requirement review</h3>
      <p>
        AI suggestions for {answer.sharedRequirements.length} selected excerpts. Other clauses,
        attachments and unshared text were not reviewed. Company retrieval is bounded; missing
        results do not prove a capability is absent.
      </p>
      <p>
        Compare every interpretation with the original notice. Requirement findings and your bid
        decision remain unchanged.
      </p>
      {answer.requirementReview.map((row, index) => {
        const excerpt = answer.sharedRequirements?.find(
          (item) => `requirement:${item.id}` === row.requirementKey,
        );
        return (
          <section
            key={row.requirementKey}
            className={styles.planCard}
            aria-label={`Requirement review ${index + 1}`}
          >
            <h4>Requirement {index + 1}</h4>
            <p>
              <strong>{labels[row.assessment]}</strong>
            </p>
            <details>
              <summary>Source excerpt shared with BidBuddy</summary>
              <blockquote>{excerpt?.text}</blockquote>
            </details>
            {excerpt?.truncated && <p>Incomplete excerpt: later conditions were not shared.</p>}
            <p>
              <strong>What it asks:</strong> {row.meaning}
            </p>
            <p>
              <strong>Company-record comparison:</strong> {row.comparison}
            </p>
            <p>
              <strong>Suggested next step:</strong> {row.nextStep}
            </p>
            {link(row.requirementKey, 'Open requirement record')}
            {row.companySources.length > 0 && (
              <ul>
                {row.companySources.map((key) => (
                  <li key={key}>
                    {link(key)} ·{' '}
                    {answer.citations.find((item) => item.key === key)?.status.replaceAll('_', ' ')}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </section>
  );
}
