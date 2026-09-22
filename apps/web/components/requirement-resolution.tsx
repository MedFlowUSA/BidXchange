'use client';
import { useActionState, useState } from 'react';
import { resolveRequirement } from '../app/requirement-resolution-actions';
import { resolutionLabels } from '../lib/requirement-resolution';
import type { TenantData } from '../lib/tenant-types';
import { TaskForm } from './capture-forms';
export default function RequirementResolution({
  data,
  requirement,
}: {
  data: TenantData;
  requirement: NonNullable<TenantData['requirements']>[number];
}) {
  const current = data.resolutions?.find((r) => r.requirement_id === requirement.id);
  const [snapshot] = useState({
    version: requirement.updated_at,
    previous: current?.id ?? '',
    evidence: (data.evidenceReviews ?? []).filter(
      (r) => r.requirement_id === requirement.id && r.approval_current === true,
    ),
  });
  const [state, action, pending] = useActionState(resolveRequirement, { message: '' });
  const [disposition, setDisposition] = useState('needs_review'),
    [reason, setReason] = useState(''),
    [evidence, setEvidence] = useState(''),
    [authority, setAuthority] = useState(''),
    [reference, setReference] = useState('');
  const canReview = ['organization_admin', 'executive_approver'].includes(data.organization.role);
  const history = (data.resolutionHistory ?? []).filter((r) => r.requirement_id === requirement.id);
  return (
    <section className="decision-brief" aria-label="Requirement resolution">
      <h4>Requirement review</h4>
      {current ? (
        <div className="info-note evidence-use-note">
          <strong>
            {current.review_current
              ? resolutionLabels[current.disposition]
              : 'Needs another review'}
          </strong>
          <p>
            {!current.review_current &&
              `Previous finding: ${resolutionLabels[current.disposition]}. `}
            {current.reason}
          </p>
          {current.disposition === 'waived' && (
            <p>
              Issuing authority: {current.authority_name}. Source: {current.authority_reference}
            </p>
          )}
          <p>
            Reviewed by {current.reviewed_by === data.userId ? 'you' : current.reviewed_by} ·{' '}
            {current.reviewed_at}
          </p>
          {!current.review_current && (
            <p>
              The requirement, supporting approval or reviewer authority changed. Refresh and review
              again.
            </p>
          )}
        </div>
      ) : (
        <p>No requirement disposition recorded.</p>
      )}
      <p>
        This is a human assessment of this requirement, not a bid or submission approval. Review
        outcomes and notes are shared with workspace members; evidence details keep their own
        visibility.
      </p>
      {data.contractorWorkflowEnabled &&
        current?.review_current &&
        current.disposition === 'blocked' &&
        ['organization_admin', 'capture_manager'].includes(data.organization.role) && (
          <details>
            <summary>Could a teaming partner address this gap?</summary>
            <p>
              For a confirmed license, specialty, local-presence, participation, experience or
              personnel gap, assign someone to investigate a partner. A partner does not
              automatically resolve the requirement; review the buyer’s conditions first.
            </p>
            <TaskForm
              data={data}
              pursuitId={requirement.pursuit_id}
              suggestedRequirementId={requirement.id}
              suggestedTitle={`Identify a teaming partner for: ${requirement.requirement}`.slice(
                0,
                200,
              )}
            />
          </details>
        )}
      {canReview && (
        <details className="company-record-editor">
          <summary>Resolve requirement</summary>
          <form
            action={action}
            className="opportunity-form admin-form"
            aria-label="Resolve requirement"
          >
            <input type="hidden" name="organization_id" value={data.organization.id} />
            <input type="hidden" name="requirement_id" value={requirement.id} />
            <input type="hidden" name="requirement_version" value={snapshot.version} />
            <input type="hidden" name="previous_id" value={snapshot.previous} />
            <fieldset disabled={pending || state.success}>
              <legend>Human requirement review</legend>
              <label>
                Disposition
                <select
                  aria-label="Disposition"
                  name="disposition"
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                >
                  {Object.entries(resolutionLabels)
                    .filter(
                      ([key]) =>
                        (key !== 'waived' || data.organization.role === 'executive_approver') &&
                        (key !== 'not_applicable' || data.contractorWorkflowEnabled),
                    )
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Reason and remaining limits
                <textarea
                  aria-label="Reason and remaining limits"
                  name="reason"
                  required
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {disposition === 'supported' ? (
                <label>
                  Approved evidence for this requirement
                  <select
                    aria-label="Approved evidence for this requirement"
                    name="evidence_review_id"
                    required
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                  >
                    <option value="">Choose a current evidence approval</option>
                    {snapshot.evidence.map((r) => (
                      <option key={r.id} value={r.id}>
                        {data.facts.find((f) => f.id === r.fact_id)?.label ?? 'Saved evidence'} ·{' '}
                        {r.reviewed_at}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="evidence_review_id" value="" />
              )}
              {disposition === 'supported' && !snapshot.evidence.length && (
                <p>
                  Approve the use of current evidence below, then refresh before resolving this
                  requirement.
                </p>
              )}
              {disposition === 'waived' ? (
                <>
                  <p>
                    Record an existing documented buyer waiver. Your workspace role does not grant
                    authority to waive a buyer requirement.
                  </p>
                  <label>
                    Issuing authority
                    <input
                      aria-label="Issuing authority"
                      name="authority_name"
                      required
                      maxLength={500}
                      value={authority}
                      onChange={(e) => setAuthority(e.target.value)}
                    />
                  </label>
                  <label>
                    Waiver source and scope
                    <textarea
                      aria-label="Waiver source and scope"
                      name="authority_reference"
                      required
                      maxLength={2000}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <>
                  <input type="hidden" name="authority_name" value="" />
                  <input type="hidden" name="authority_reference" value="" />
                </>
              )}
              <p>
                Do not paste restricted evidence into shared review notes. A finding can be
                superseded; earlier reviews remain in history.
              </p>
              <button className="button primary" type="submit">
                {pending ? 'Recording…' : 'Save requirement review'}
              </button>
            </fieldset>
            <p role="status">{state.message}</p>
            {state.success && (
              <button
                className="button secondary"
                type="button"
                onClick={() => window.location.reload()}
              >
                View saved requirement review
              </button>
            )}
          </form>
        </details>
      )}
      {!!history.length && (
        <details>
          <summary>Requirement review history</summary>
          <p>
            Entries from the latest 100 reviews loaded for this pursuit. Earlier reviews may be
            outside this view.
          </p>
          <ol>
            {history.map((r) => (
              <li key={r.id}>
                <strong>{resolutionLabels[r.disposition]}</strong>
                <p>{r.reason}</p>
                {r.disposition === 'waived' && (
                  <p>
                    {r.authority_name} · {r.authority_reference}
                  </p>
                )}
                <p>
                  {r.reviewed_at} · {r.reviewed_by === data.userId ? 'You' : r.reviewed_by}
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
