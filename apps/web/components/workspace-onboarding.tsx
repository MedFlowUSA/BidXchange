'use client';

import { useActionState } from 'react';
import {
  createCompany,
  acceptInvitation,
  inviteMember,
  revokeInvitation,
} from '../app/onboarding/actions';
import {
  invitationRoles,
  roleLabel,
  type IncomingInvitation,
  type ManagedInvitation,
} from '../lib/workspace-onboarding';

export function CreateCompanyForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(createCompany, { message: '' });
  return (
    <form action={action} className="opportunity-form">
      <input type="hidden" name="request_id" value={requestId} />
      <label>
        Legal company name
        <input name="legal_name" required maxLength={200} autoComplete="organization" />
      </label>
      <label>
        Operating name / DBA
        <input name="operating_name" required maxLength={200} />
      </label>
      <p>
        Use the legal name again if you do not use a DBA. You will be the company administrator.
        These names are saved as workspace details, not attested evidence.
      </p>
      <button className="button primary" disabled={pending}>
        {pending ? 'Creating company…' : 'Create company workspace'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}

export function AcceptInvitationForm({ invitation }: { invitation: IncomingInvitation }) {
  const [state, action, pending] = useActionState(acceptInvitation, { message: '' });
  return (
    <form action={action} className="opportunity-form">
      <input type="hidden" name="invitation_id" value={invitation.id} />
      <h3>{invitation.organization_name}</h3>
      <p>
        Invited role: {roleLabel(invitation.role)}. Expires{' '}
        {new Date(invitation.expires_at).toISOString().slice(0, 10)} (UTC).
      </p>
      <button className="button primary" disabled={pending}>
        {pending ? 'Joining…' : 'Accept invitation'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}

export function InviteMemberForm({
  organizationId,
  joinUrl,
}: {
  organizationId: string;
  joinUrl: string;
}) {
  const [state, action, pending] = useActionState(inviteMember, { message: '' });
  return (
    <>
      <form action={action} className="opportunity-form">
        <input type="hidden" name="organization_id" value={organizationId} />
        <label>
          Colleague’s work email
          <input type="email" name="email" required maxLength={254} autoComplete="off" />
        </label>
        <label>
          Workspace role
          <select name="role" defaultValue="viewer">
            {Object.entries(invitationRoles).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p>
          Administrators control membership and company records. Approvers can attest evidence and
          approve specific response versions. Choose only the access this colleague needs.
        </p>
        <button className="button primary" disabled={pending}>
          {pending ? 'Creating invitation…' : 'Create invitation'}
        </button>
        <p role="status">{state.message}</p>
      </form>
      <p>After creating the invitation, share this address with the colleague:</p>
      <p>
        <a href={joinUrl}>{joinUrl}</a>
      </p>
      <p>
        They must confirm the exact invited email address. The address alone does not grant access.
        Invitations expire after seven days; no invitation email is sent automatically.
      </p>
    </>
  );
}

export function RevokeInvitationForm({
  organizationId,
  invitation,
}: {
  organizationId: string;
  invitation: ManagedInvitation;
}) {
  const [state, action, pending] = useActionState(revokeInvitation, { message: '' });
  return (
    <form action={action}>
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="invitation_id" value={invitation.id} />
      <button className="button secondary" disabled={pending}>
        {pending ? 'Revoking…' : `Revoke invitation for ${invitation.email}`}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
