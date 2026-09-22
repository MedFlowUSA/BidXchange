'use client';
import { useActionState, useState } from 'react';
import type { TenantData } from '../lib/tenant-types';
import { hasCurrentRegisterSignoff } from '../lib/workspace-guide';
import { signOffRegister } from '../app/register-signoff-actions';
export default function RegisterSignoff({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const [state, action, pending] = useActionState(signOffRegister, { message: '' });
  const [context] = useState(data.decisionContext ?? '');
  if (!data.registerSignoffsEnabled) return null;
  const latest = data.registerSignoffs?.[0];
  const current = hasCurrentRegisterSignoff(data);
  return (
    <section className="panel" id="register-signoff">
      <h2>Requirements Register sign-off</h2>
      <p>
        Candidate requirements may be incomplete or inaccurate until a person reviews and signs off
        on the Requirements Register.
      </p>
      <p>
        {current
          ? 'A human sign-off matches this review context.'
          : 'Human sign-off is required before a final bid or no-bid decision.'}
      </p>
      {latest && (
        <p>
          Last sign-off: {latest.signed_off_at} by{' '}
          {latest.signed_off_by === data.userId ? 'You' : latest.signed_off_by}.{' '}
          {latest.requirement_count} requirements; {latest.blocker_count} recorded blockers.{' '}
          {current
            ? ''
            : 'This sign-off is stale; review the changed source, evidence or requirements.'}
        </p>
      )}
      {['organization_admin', 'executive_approver'].includes(data.organization.role) && (
        <form action={action} className="opportunity-form">
          <input type="hidden" name="organization_id" value={data.organization.id} />
          <input type="hidden" name="pursuit_id" value={pursuitId} />
          <input type="hidden" name="context" value={context} />
          <fieldset disabled={pending || state.success}>
            <legend>Human review</legend>
            <label>
              Register review note
              <textarea name="note" required maxLength={4000} />
            </label>
            <label>
              <input type="checkbox" name="acknowledged" required />I reviewed the register against
              the source, including omissions, blockers and unresolved questions. This is not an
              eligibility certification.
            </label>
            <button className="button primary">
              {pending ? 'Saving…' : 'Sign off Requirements Register'}
            </button>
          </fieldset>
          <p role="status">{state.message}</p>
          {state.success && (
            <button type="button" onClick={() => window.location.reload()}>
              Refresh sign-off status
            </button>
          )}
        </form>
      )}
    </section>
  );
}
