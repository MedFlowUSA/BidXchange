'use client';
import { hasCurrentRegisterSignoff } from '../lib/workspace-guide';
import { useActionState, useState } from 'react';
import { recordDecision } from '../app/decision-actions';
import type { TenantData, LivePursuit } from '../lib/tenant-types';
import { decisionReasons } from '../lib/decision-reasons';
const labels: Record<string, string> = {
  bid: 'Pursue bid',
  no_bid: 'Do not bid',
  pending: 'Reopen review',
  draft: 'Draft decision',
  leaning_bid: 'Leaning bid',
  leaning_pass: 'Leaning pass',
};
export default function PursuitDecision({
  data,
  pursuit,
}: {
  data: TenantData;
  pursuit: LivePursuit;
}) {
  const [state, action, pending] = useActionState(recordDecision, { message: '' });
  const [snapshot] = useState({ version: pursuit.updated_at, context: data.decisionContext });
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [conditions, setConditions] = useState('');
  const [ack, setAck] = useState(false);
  const latest = data.decisions?.[0];
  const canDecide = ['organization_admin', 'executive_approver'].includes(data.organization.role);
  return (
    <section className="panel decision-brief" id="bid-decision" aria-label="Bid/no-bid decision">
      <h2>Bid/no-bid decision</h2>
      {latest ? (
        <>
          <h3>{labels[latest.preliminary_state || latest.decision]}</h3>
          <p>{latest.reason}</p>
          {!!latest.reason_codes?.length && (
            <p>
              Reasons:{' '}
              {latest.reason_codes
                .map((code) => decisionReasons[code as keyof typeof decisionReasons] || code)
                .join(', ')}
            </p>
          )}
          {latest.estimated_pursuit_hours != null && (
            <p>Estimated pursuit hours, entered by a person: {latest.estimated_pursuit_hours}</p>
          )}
          <p>Conditions: {latest.conditions || 'None recorded.'}</p>
          <p>
            Recorded by {latest.decided_by === data.userId ? 'you' : latest.decided_by} at{' '}
            {latest.decided_at}.
          </p>
          {latest.context_token !== data.decisionContext && (
            <p role="status">
              Review again: the opportunity, requirements, company evidence or review date has
              changed since this decision.
            </p>
          )}
        </>
      ) : (
        <p>
          No human decision recorded. Review the notice, evidence and unresolved conditions first.
        </p>
      )}
      <p>
        This records an intent to pursue or decline. It does not authorize pricing, certifications
        or submission. Decisions are historical records; refresh and review changes before acting.
      </p>
      {canDecide && (
        <details className="company-record-editor">
          <summary>Record a decision</summary>
          <form
            action={action}
            className="opportunity-form admin-form"
            aria-label="Record pursuit decision"
          >
            <input type="hidden" name="organization_id" value={data.organization.id} />
            <input type="hidden" name="pursuit_id" value={pursuit.id} />
            <input type="hidden" name="version" value={snapshot.version ?? ''} />
            <input type="hidden" name="context" value={snapshot.context ?? ''} />
            <fieldset disabled={pending || state.success}>
              <legend>Human decision record</legend>
              <label>
                Decision
                <select
                  aria-label="Decision"
                  name="decision"
                  required
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                >
                  <option value="">Choose a decision</option>
                  {Object.entries(labels)
                    .filter(
                      ([value]) =>
                        data.registerSignoffsEnabled ||
                        ['bid', 'no_bid', 'pending'].includes(value),
                    )
                    .map(([value, label]) => (
                      <option
                        key={value}
                        value={value}
                        disabled={
                          data.registerSignoffsEnabled &&
                          ['bid', 'no_bid'].includes(value) &&
                          !hasCurrentRegisterSignoff(data)
                        }
                      >
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              {data.registerSignoffsEnabled && (
                <>
                  <p>
                    Final bid and no-bid decisions require a current human Requirements Register
                    sign-off. Preliminary decisions remain available.
                  </p>
                  <label>
                    Primary reason code
                    <select name="reason_code">
                      <option value="">Not specified</option>
                      {Object.entries(decisionReasons).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Estimated pursuit hours
                    <input name="pursuit_hours" type="number" min="0" max="100000" step="0.25" />
                  </label>
                </>
              )}
              <label>
                Reason
                <textarea
                  name="reason"
                  aria-label="Reason"
                  required
                  maxLength={4000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label>
                Conditions and unresolved risks
                <textarea
                  name="conditions"
                  aria-label="Conditions and unresolved risks"
                  maxLength={4000}
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                />
              </label>
              <p>
                Reason and conditions are visible to all active workspace members. Do not paste
                restricted evidence into this record.
              </p>
              <label>
                <input
                  type="checkbox"
                  name="acknowledged"
                  required
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I reviewed the opportunity and unresolved requirements. This decision does not
                authorize pricing, certifications or submission.
              </label>
              <button className="button primary" type="submit">
                {pending ? 'Recording…' : 'Record decision'}
              </button>
            </fieldset>
            <p role="status">{state.message}</p>
            {state.success && (
              <button
                className="button secondary"
                type="button"
                onClick={() => window.location.reload()}
              >
                View recorded decision
              </button>
            )}
          </form>
        </details>
      )}
      {!!data.decisions?.length && (
        <details>
          <summary>Decision history · latest {data.decisions.length}</summary>
          <ol>
            {data.decisions.map((d) => (
              <li key={d.id}>
                <strong>{labels[d.preliminary_state || d.decision]}</strong>
                <p>{d.reason}</p>
                <p>{d.conditions || 'No conditions recorded.'}</p>
                <p>
                  {d.decided_at} · {d.decided_by === data.userId ? 'You' : d.decided_by}
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
