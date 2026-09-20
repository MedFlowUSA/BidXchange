'use client';
import { useActionState, useState } from 'react';
import { saveRequirement } from '../app/capture-actions';
import type { MutationState } from '../app/actions';
import type { TenantData } from '../lib/tenant-types';
import { amendmentPreview } from '../lib/amendment-preview';

export default function RequirementAmendment({
  data,
  requirement,
}: {
  data: TenantData;
  requirement: NonNullable<TenantData['requirements']>[number];
}) {
  const [original] = useState(requirement);
  const [text, setText] = useState(original.requirement);
  const [citation, setCitation] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [state, submit, pending] = useActionState(saveRequirement, {
    message: '',
  } as MutationState);
  const preview = amendmentPreview(original.requirement, text);
  const changed = preview.changed || citation.trim() !== (original.citation ?? '').trim();
  const approvals = data.evidenceReviewsEnabled
    ? (data.evidenceReviews ?? []).filter(
        (r) => r.requirement_id === original.id && r.approval_current === true,
      ).length
    : 0;
  return (
    <details className="company-record-editor amendment-editor">
      <summary>Review an amendment</summary>
      <form
        action={submit}
        className="opportunity-form admin-form"
        aria-label="Review an amendment"
      >
        <input type="hidden" name="organization_id" value={data.organization.id} />
        <input type="hidden" name="record_id" value={original.id} />
        <input type="hidden" name="pursuit_id" value={original.pursuit_id} />
        <input type="hidden" name="updated_at" value={original.updated_at} />
        <input type="hidden" name="owner_user_id" value={original.owner_user_id ?? ''} />
        <input type="hidden" name="status" value="needs_review" />
        <p>
          Compare the buyer’s amendment with this requirement. Save one reviewed change at a time.
          This register is shared with workspace members.
        </p>
        <fieldset disabled={pending || state.success}>
          <legend>Amendment review</legend>
          <div className="amendment-comparison">
            <div>
              <h4>Saved requirement</h4>
              <p className="amendment-text">{original.requirement}</p>
              <p>Source: {original.citation || 'Not recorded'}</p>
            </div>
            <label>
              Revised requirement
              <textarea
                aria-label="Revised requirement"
                name="requirement"
                required
                maxLength={4000}
                rows={6}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
          </div>
          <label>
            Amendment citation
            <textarea
              aria-label="Amendment citation"
              name="citation"
              required
              maxLength={2000}
              rows={3}
              placeholder="Amendment number, issued date, section/page and source URL or reference"
              value={citation}
              onChange={(e) => {
                setCitation(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          {preview.changed && (
            <div className="amendment-diff">
              <h4>Text change</h4>
              <p className="amendment-text">
                {preview.prefix}
                {preview.removed && <del>{preview.removed}</del>}
                {preview.inserted && <ins>{preview.inserted}</ins>}
                {preview.suffix}
              </p>
              <p>
                Struck through: removed. Underlined: added. This highlights text differences, not
                their meaning.
              </p>
            </div>
          )}
          <p>
            Saving sets follow-up to Needs review. Previous requirement findings and evidence
            approvals will need another review; any saved bid decision will need its context checked
            again. Current evidence approvals visible for this requirement: {approvals}. Restricted
            or unloaded records may be outside this count.
          </p>
          <p>
            The citation replaces the current citation. Include references still needed to
            understand the revised requirement. This does not retain a document copy or record an
            acknowledgment to the buyer.
          </p>
          <label className="amendment-confirm">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I checked the cited amendment and reviewed the change above.
          </label>
          <button
            className="button primary"
            type="submit"
            disabled={!changed || !confirmed || !text.trim() || !citation.trim()}
          >
            {pending ? 'Saving…' : 'Save amended requirement'}
          </button>
        </fieldset>
        {state.message && <p role="status">{state.message}</p>}
        {state.success && (
          <button
            className="button secondary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Review affected records
          </button>
        )}
      </form>
    </details>
  );
}
