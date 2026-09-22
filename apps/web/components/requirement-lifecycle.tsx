'use client';
import { useActionState, useState } from 'react';
import type { TenantData } from '../lib/tenant-types';
import { changeRequirementLifecycle } from '../app/requirement-lifecycle-actions';

type Requirement = NonNullable<TenantData['requirements']>[number];
export function RequirementCorrection({
  data,
  requirement,
  archived = false,
}: {
  data: TenantData;
  requirement: Requirement;
  archived?: boolean;
}) {
  const [snapshot] = useState({
    source: requirement,
    targets: (data.requirements ?? []).filter(
      (r) => r.id !== requirement.id && r.pursuit_id === requirement.pursuit_id,
    ),
  });
  const [operation, setOperation] = useState(archived ? 'restore' : 'archive');
  const [targetId, setTargetId] = useState('');
  const [wording, setWording] = useState('');
  const [state, action, pending] = useActionState(changeRequirementLifecycle, { message: '' });
  const target = snapshot.targets.find((r) => r.id === targetId);
  if (!['organization_admin', 'capture_manager'].includes(data.organization.role)) return null;
  return (
    <details className="company-record-editor">
      <summary>{archived ? 'Restore requirement' : 'Archive or merge requirement'}</summary>
      <form
        action={action}
        className="opportunity-form"
        aria-label={archived ? 'Restore requirement' : 'Correct requirement'}
      >
        <input type="hidden" name="organization_id" value={data.organization.id} />
        <input type="hidden" name="pursuit_id" value={snapshot.source.pursuit_id} />
        <input type="hidden" name="requirement_id" value={snapshot.source.id} />
        <input type="hidden" name="expected_source" value={snapshot.source.updated_at} />
        <input
          type="hidden"
          name="expected_target"
          value={operation === 'merge' ? (target?.updated_at ?? '') : ''}
        />
        <fieldset disabled={pending || state.success}>
          <legend>Preserve history and request another review</legend>
          {archived ? (
            <>
              <input type="hidden" name="operation" value="restore" />
              <p>
                Restore this original requirement as a separate active row needing review. If it was
                merged, the target’s combined wording remains unchanged; review both rows for
                duplicates.
              </p>
            </>
          ) : (
            <label>
              Correction action
              <select
                aria-label="Correction action"
                name="operation"
                value={operation}
                onChange={(e) => setOperation(e.target.value)}
              >
                <option value="archive">Archive incorrect requirement</option>
                <option value="merge">Merge duplicate into another requirement</option>
              </select>
            </label>
          )}
          {operation === 'merge' ? (
            <>
              <label>
                Keep this target requirement
                <select
                  aria-label="Keep this target requirement"
                  name="target_id"
                  required
                  value={targetId}
                  onChange={(e) => {
                    setTargetId(e.target.value);
                    const selected = snapshot.targets.find((r) => r.id === e.target.value);
                    setWording(
                      selected ? `${selected.requirement}\n${snapshot.source.requirement}` : '',
                    );
                  }}
                >
                  <option value="">Choose an active requirement</option>
                  {snapshot.targets.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.requirement.slice(0, 120)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Combined requirement wording
                <textarea
                  aria-label="Combined requirement wording"
                  name="merged_text"
                  value={wording}
                  onChange={(e) => setWording(e.target.value)}
                  required
                  maxLength={4000}
                  rows={5}
                />
              </label>
              <p>Both source citations are preserved automatically:</p>
              <p style={{ whiteSpace: 'pre-wrap' }}>
                {target?.citation || 'Choose a cited target'}
                {'\n'}
                {snapshot.source.citation || 'Source citation missing — add it before merging'}
              </p>
              <p>
                The original row is archived. Evidence approvals and tasks stay linked to their
                original rows; they are not transferred or treated as approval of the combined
                requirement. Review and link applicable evidence to the target yourself.
              </p>
            </>
          ) : (
            <>
              <input type="hidden" name="target_id" value="" />
              <input type="hidden" name="merged_text" value="" />
            </>
          )}
          <label>
            Correction reason
            <textarea aria-label="Correction reason" name="reason" required maxLength={2000} />
          </label>
          <label>
            <input type="checkbox" name="acknowledged" required />I understand this preserves
            history, changes the active register and requires fresh human review of affected
            decisions and approvals. Linked tasks are not automatically completed.
          </label>
          <button
            className="button"
            disabled={operation === 'merge' && (!target || !wording.trim())}
          >
            {pending
              ? 'Saving…'
              : operation === 'merge'
                ? 'Merge requirements'
                : archived
                  ? 'Restore requirement for review'
                  : 'Archive requirement'}
          </button>
        </fieldset>
        <p role="status">{state.message}</p>
        {state.success && (
          <button className="button" type="button" onClick={() => window.location.reload()}>
            Refresh Requirements Register
          </button>
        )}
      </form>
    </details>
  );
}

export function RequirementArchive({ data }: { data: TenantData }) {
  return (
    <section className="panel" aria-labelledby="requirement-archive-title">
      <h3 id="requirement-archive-title">Archived requirements and correction history</h3>
      <p>
        Archived rows are excluded from the active register and new response outlines. Original
        citations, evidence links, tasks and historical approvals are retained. Archiving is not a
        buyer waiver or proof that an obligation no longer applies.
      </p>
      {!data.archivedRequirements?.length && (
        <p>
          No archived requirements. Use “Archive or merge requirement” on an active row to correct a
          duplicate or an incorrect entry without deleting its history.
        </p>
      )}
      {(data.archivedRequirements ?? []).slice(0, 100).map((r) => (
        <details className="panel" key={`${r.id}:${r.updated_at}`}>
          <summary>{r.requirement}</summary>
          <article id={`requirement-${r.id}`}>
            <p style={{ whiteSpace: 'pre-wrap' }}>
              Original source: {r.citation || 'Not recorded'}
            </p>
            <p>
              Archived {r.archived_at} by {r.archived_by === data.userId ? 'you' : r.archived_by}.
              Reason: {r.archive_reason}
            </p>
            {r.merged_into_id && (
              <p>
                Merged into requirement{' '}
                <a href={`#requirement-${r.merged_into_id}`}>{r.merged_into_id}</a>. Original
                evidence approvals were not transferred.
              </p>
            )}
            <p>
              {
                data.tasks.filter((t) => t.requirement_id === r.id && t.status !== 'complete')
                  .length
              }{' '}
              visible open tasks remain linked to this row. Review them in Tasks.
            </p>
            <RequirementCorrection data={data} requirement={r} archived />
          </article>
        </details>
      ))}
      {(data.archivedRequirements?.length ?? 0) > 100 && (
        <p role="status">
          Showing the 100 most recently archived rows. Contact your administrator for older scoped
          records.
        </p>
      )}
      <details>
        <summary>Correction history</summary>
        {!data.requirementLifecycle?.length && (
          <p>No archive, restore or merge events recorded yet.</p>
        )}
        {(data.requirementLifecycle ?? []).slice(0, 50).map((h) => (
          <article key={h.id}>
            <h4>
              {h.action} · {h.recorded_at}
            </h4>
            <p>
              Recorded by {h.recorded_by === data.userId ? 'you' : h.recorded_by}: {h.reason}
            </p>
            <p>Original requirement: {h.before_source.requirement}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}>Original citation: {h.before_source.citation}</p>
            {h.before_target && (
              <>
                <p>Target before merge: {h.before_target.requirement}</p>
                <p style={{ whiteSpace: 'pre-wrap' }}>
                  Target citation: {h.before_target.citation}
                </p>
              </>
            )}
          </article>
        ))}
        {(data.requirementLifecycle?.length ?? 0) > 50 && (
          <p>Showing the latest 50 corrections; earlier audit records are retained.</p>
        )}
      </details>
    </section>
  );
}
