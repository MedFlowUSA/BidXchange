import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { pursuitBrief } from '../lib/pursuit-brief';
import { resolutionLabels } from '../lib/requirement-resolution';

export default function PursuitDecisionBrief({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const { rows, partial } = pursuitBrief(data, pursuitId);
  return (
    <section className="panel decision-brief" aria-labelledby="decision-brief-heading">
      <div className="eyebrow">Before the bid/no-bid discussion</div>
      <h2 id="decision-brief-heading">What still needs a decision?</h2>
      <p>
        Resolve the notice requirements below with the responsible reviewer. An evidence approval
        supports one requirement; it does not establish eligibility or authorize a bid.
      </p>
      <p>
        Visible records as of {data.reviewAsOf}. Refresh before deciding. Restricted evidence may be
        outside your view.
      </p>
      {partial && (
        <p role="status">
          This is a partial brief because a record limit was reached. Review the full register
          before making a decision.
        </p>
      )}
      {data.resolutionsEnabled && rows.length > 0 && (
        <p>
          In this visible register, {rows.filter((r) => r.resolved).length} requirements have
          current support or a documented waiver; {rows.filter((r) => !r.resolved).length} still
          need resolution. This is review progress, not an eligibility score.
        </p>
      )}
      {!data.evidenceReviewsEnabled && (
        <p>
          Evidence-use reviews are unavailable. This brief cannot assess saved evidence approvals.
        </p>
      )}
      {!rows.length ? (
        <p>
          No requirements are visible. Record and cite the notice requirements before using this
          brief; an empty register does not mean there are no obligations.
        </p>
      ) : (
        <details open>
          <summary>{rows.length} visible requirements to discuss</summary>
          <ul className="decision-brief-list">
            {rows.map(({ requirement, approved, issues, resolution, resolved }) => (
              <li key={requirement.id}>
                <Link href={`#requirement-${requirement.id}`}>{requirement.requirement}</Link>
                {resolution && (
                  <p>
                    Requirement review:{' '}
                    {resolution.review_current
                      ? resolutionLabels[resolution.disposition]
                      : 'Needs another review'}
                  </p>
                )}
                <p>
                  {requirement.citation
                    ? `Notice: ${requirement.citation}`
                    : 'No notice citation recorded.'}
                </p>
                <p>
                  {issues.length
                    ? issues.join(' · ')
                    : resolved
                      ? 'Human review recorded. Confirm its scope before relying on it.'
                      : 'Confirm the requirement interpretation and remaining conditions with the reviewer.'}
                </p>
                {approved > 0 && (
                  <p>
                    {approved} current evidence {approved === 1 ? 'approval' : 'approvals'} visible.
                    {resolved
                      ? 'Requirement review is recorded separately.'
                      : 'Requirement compliance still needs a human assessment.'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
