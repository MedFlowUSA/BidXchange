'use client';
import { useActionState, useState } from 'react';
import { saveCompanyRecord } from '../app/company-record-actions';
import { companyRecordTypes, workspaceRecordTypes } from '../lib/company-record-input';
import type { Fact, TenantData } from '../lib/tenant-types';

export default function CompanyRecordForm({
  organizationId,
  types,
  members,
  userId,
  fact,
}: {
  organizationId: string;
  types: readonly string[];
  members: TenantData['members'];
  userId: string;
  fact?: Fact;
}) {
  const [state, action, pending] = useActionState(saveCompanyRecord, { message: '' });
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState(fact?.fact_type ?? types[0]);
  const [sensitivity, setSensitivity] = useState(
    fact?.sensitivity === 'workspace' ? 'workspace' : 'restricted',
  );
  const [draft, setDraft] = useState({
    label: fact?.label ?? '',
    value: fact?.value ?? '',
    source_reference: fact?.source_reference ?? '',
    source_note: fact?.source_note ?? '',
    owner_user_id:
      fact?.owner_user_id &&
      !members.some((member) => member.user_id === fact.owner_user_id && member.status === 'active')
        ? ''
        : (fact?.owner_user_id ?? userId),
    effective_date: fact?.effective_date ?? '',
    expiration_date: fact?.expiration_date ?? '',
  });
  const change = (field: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));
  if (fact && !companyRecordTypes.includes(fact.fact_type)) return null;
  return (
    <details
      className="company-record-editor"
      aria-label={fact ? `Edit ${fact.label}` : `Add ${types[0]} evidence`}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{fact ? 'Edit saved evidence' : 'Add an evidence record'}</summary>
      {expanded && (
        <form
          action={action}
          className="opportunity-form admin-form"
          aria-label={fact ? `Edit ${fact.label}` : `Add ${types[0]} evidence`}
        >
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="fact_id" value={fact?.id ?? ''} />
          <input type="hidden" name="updated_at" value={fact?.updated_at ?? ''} />
          <fieldset disabled={pending || (!fact && state.success)}>
            <legend>
              {fact
                ? 'Correct the saved record'
                : 'Save one record, then continue when you are ready'}
            </legend>
            <label>
              Category
              <select
                name="fact_type"
                aria-label="Category"
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setSensitivity('restricted');
                }}
              >
                {types.map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Record label
              <input
                name="label"
                value={draft.label}
                onChange={(event) => change('label', event.target.value)}
                required
                maxLength={160}
                placeholder="For example: CSLB license, SAM registration, or project reference"
              />
            </label>
            <label>
              Known information
              <textarea
                name="value"
                aria-label="Known information"
                value={draft.value}
                onChange={(event) => change('value', event.target.value)}
                maxLength={4000}
                rows={3}
              />
            </label>
            <p>
              Leave unknown information blank. Do not enter passwords, full tax identifiers or bank
              details.
            </p>
            <label>
              Evidence reference
              <input
                name="source_reference"
                value={draft.source_reference}
                onChange={(event) => change('source_reference', event.target.value)}
                maxLength={2000}
                placeholder="Source URL, document title, or registry reference"
              />
            </label>
            <label>
              Source and review notes
              <textarea
                name="source_note"
                aria-label="Source and review notes"
                value={draft.source_note}
                onChange={(event) => change('source_note', event.target.value)}
                maxLength={2000}
                rows={2}
              />
            </label>
            <label>
              Record owner
              <select
                name="owner_user_id"
                aria-label="Record owner"
                value={draft.owner_user_id}
                onChange={(event) => change('owner_user_id', event.target.value)}
                required
              >
                {fact?.owner_user_id &&
                  !members.some(
                    (member) => member.user_id === fact.owner_user_id && member.status === 'active',
                  ) && <option value="">Select an active owner</option>}
                {members
                  .filter((member) => member.status === 'active')
                  .map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.user_id === userId ? 'You' : member.user_id} ·{' '}
                      {member.role.replaceAll('_', ' ')}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Effective date
              <input
                type="date"
                name="effective_date"
                value={draft.effective_date}
                onChange={(event) => change('effective_date', event.target.value)}
              />
            </label>
            <label>
              Expiration date
              <input
                type="date"
                name="expiration_date"
                value={draft.expiration_date}
                onChange={(event) => change('expiration_date', event.target.value)}
              />
            </label>
            <label>
              Visibility
              <select
                name="sensitivity"
                aria-label="Visibility"
                value={sensitivity}
                onChange={(event) => setSensitivity(event.target.value)}
              >
                <option value="restricted">
                  Restricted: administrators, executive approvers and estimators
                </option>
                {workspaceRecordTypes.has(type) && (
                  <option value="workspace">All active company members</option>
                )}
              </select>
            </label>
            <p>
              Visibility covers the entire record, including sources and notes. Saving clears
              verification. It does not approve proposal use or establish eligibility.
            </p>
            <button className="button primary" type="submit">
              {pending ? 'Saving…' : fact ? 'Save correction' : 'Save evidence record'}
            </button>
          </fieldset>
          <p role="status">{state.message}</p>
          {!fact && state.success && (
            <button
              type="button"
              className="button secondary"
              onClick={() => window.location.reload()}
            >
              Add another record
            </button>
          )}
        </form>
      )}
    </details>
  );
}
