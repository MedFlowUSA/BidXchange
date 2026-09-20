'use client';
import { useActionState, useState } from 'react';
import { reviewEvidenceUse } from '../app/evidence-use-actions';
import type { TenantData } from '../lib/tenant-types';
export default function EvidenceUseReview({
  data,
  requirement,
}: {
  data: TenantData;
  requirement: NonNullable<TenantData['requirements']>[number];
}) {
  const [state, action, pending] = useActionState(reviewEvidenceUse, { message: '' });
  const [snapshot] = useState({ facts: data.facts, version: requirement.updated_at });
  const [factId, setFactId] = useState('');
  const [applicability, setApplicability] = useState('unknown');
  const [proposalUse, setProposalUse] = useState('not_approved');
  const [reason, setReason] = useState('');
  const fact = snapshot.facts.find((item) => item.id === factId);
  const reviewer = ['organization_admin', 'executive_approver'].includes(data.organization.role);
  const reviews = (data.evidenceReviews ?? []).filter(
    (item) => item.requirement_id === requirement.id,
  );
  return (
    <section aria-label="Evidence applicability and proposal use">
      <h4>Evidence for this requirement</h4>
      {!reviews.length && <p>No evidence-use reviews are visible for this requirement.</p>}
      {reviews.map((review) => (
        <div key={review.id} className="info-note evidence-use-note">
          <strong>
            {review.approval_current === true
              ? 'Approved for this requirement'
              : review.proposal_use === 'approved'
                ? 'Previous approval needs review'
                : 'Not approved for proposal use'}
          </strong>
          <p>
            Evidence:{' '}
            {data.facts.find((item) => item.id === review.fact_id)?.label ??
              'Saved company evidence'}
          </p>
          <p>
            Applicability: {review.applicability.replaceAll('_', ' ')}. {review.reason}
          </p>
          <p>
            Reviewer: {review.reviewed_by === data.userId ? 'You' : review.reviewed_by} ·{' '}
            {review.reviewed_at}
          </p>
        </div>
      ))}
      <p>
        Reviews apply to an evidence/requirement pair. “Not applicable” does not waive the
        requirement. Changes or expiration require another review. Up to 500 visible reviews are
        loaded for this pursuit.
      </p>
      {reviewer && (
        <details className="company-record-editor">
          <summary>Review evidence use</summary>
          <form
            action={action}
            className="opportunity-form admin-form"
            aria-label="Review evidence use"
          >
            <input type="hidden" name="organization_id" value={data.organization.id} />
            <input type="hidden" name="requirement_id" value={requirement.id} />
            <input type="hidden" name="requirement_version" value={snapshot.version} />
            <input type="hidden" name="fact_version" value={fact?.updated_at ?? ''} />
            <fieldset disabled={pending || state.success}>
              <legend>Human evidence review</legend>
              <label>
                Company evidence
                <select
                  aria-label="Company evidence"
                  name="fact_id"
                  required
                  value={factId}
                  onChange={(event) => setFactId(event.target.value)}
                >
                  <option value="">Choose visible evidence</option>
                  {snapshot.facts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Applicability
                <select
                  aria-label="Applicability"
                  name="applicability"
                  value={applicability}
                  onChange={(event) => setApplicability(event.target.value)}
                >
                  <option value="unknown">Needs assessment</option>
                  <option value="applicable">Applies to this requirement</option>
                  <option value="not_applicable">Does not apply to this requirement</option>
                </select>
              </label>
              <label>
                Proposal use
                <select
                  aria-label="Proposal use"
                  name="proposal_use"
                  value={proposalUse}
                  onChange={(event) => setProposalUse(event.target.value)}
                >
                  <option value="not_approved">Not approved</option>
                  <option value="approved">Approve this evidence for this requirement</option>
                </select>
              </label>
              <label>
                Reason and limits
                <textarea
                  aria-label="Reason and limits"
                  name="reason"
                  required
                  maxLength={2000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <p>
                Approval requires current verified evidence and a cited requirement. Notes share the
                evidence’s visibility. This does not authorize pricing, certifications or
                submission.
              </p>
              <button className="button primary" type="submit">
                {pending ? 'Saving…' : 'Save evidence-use review'}
              </button>
            </fieldset>
            <p role="status">{state.message}</p>
            {state.success && (
              <button
                className="button secondary"
                type="button"
                onClick={() => window.location.reload()}
              >
                Continue with saved reviews
              </button>
            )}
          </form>
        </details>
      )}
    </section>
  );
}
