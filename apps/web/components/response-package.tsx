'use client';
import { useActionState, useState } from 'react';
import type { TenantData } from '../lib/tenant-types';
import {
  newResponseDraft,
  readResponseDraft,
  type SavedResponsePackage,
} from '../lib/response-package';
import { saveResponsePackage } from '../app/response-package-actions';
import { responseAutofill } from '../lib/response-autofill';
import { workspaceHref } from '../lib/routes';

function AutofillPreview({ data, pursuitId }: { data: TenantData; pursuitId: string }) {
  let fields;
  try {
    fields = responseAutofill(data, pursuitId, new Date(data.reviewAsOf));
  } catch {
    return (
      <p role="status">
        The automatic company information is unavailable. Reload and review the company profile
        before exporting.
      </p>
    );
  }
  return (
    <details className="panel" aria-label="Automatic document information">
      <summary>Automatically included: company and bid information</summary>
      <p>
        These fields populate every RFI, RFP and RFQ PDF and Word draft from current records.
        Downloads refresh the values; your written answers stay as saved.
      </p>
      <h3>Company and bid details</h3>
      <dl>
        {[...fields.company, ...fields.bid].map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <h3>Verified company records and relevant qualifications</h3>
      {fields.facts.length ? (
        <dl>
          {fields.facts.map((f) => (
            <div key={f.id}>
              <dt>{f.label}</dt>
              <dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {f.value}
                <br />
                <small>Source: {f.source_reference}</small>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>
          No current exportable company records. Add or verify records in Company, and review
          qualifications against the pursuit requirements.
        </p>
      )}
      {!!fields.gaps.length && (
        <>
          <h3>Information to complete</h3>
          <ul>
            {fields.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </>
      )}
      <a href={workspaceHref('/company', data.organization.id)}>Update company information</a>
    </details>
  );
}

function Editor({
  data,
  pursuitId,
  saved,
}: {
  data: TenantData;
  pursuitId: string;
  saved?: SavedResponsePackage;
}) {
  const [snapshot] = useState(() => ({
    version: saved?.updated_at ?? '',
    draft: readResponseDraft(saved?.content ?? null) ?? newResponseDraft(data, pursuitId),
  }));
  const [draft, setDraft] = useState(() => {
    const fresh = newResponseDraft(data, pursuitId);
    return {
      ...fresh,
      kind: snapshot.draft.kind,
      summary: snapshot.draft.summary,
      answers: fresh.answers.map((a) => ({
        ...a,
        text:
          snapshot.draft.answers.find((old) => old.requirementId === a.requirementId)?.text ?? '',
      })),
    };
  });
  const [title, setTitle] = useState(
    saved?.title.replace(/^RF[IPQ] response: /, '') ?? 'Initial response',
  );
  const [state, action, pending] = useActionState(saveResponsePackage, { message: '' });
  const changed = Boolean(
    saved && (!snapshot.draft.context || snapshot.draft.context !== data.decisionContext),
  );
  return (
    <form
      action={action}
      className="opportunity-form admin-form"
      aria-label={`Edit ${draft.kind} response`}
    >
      <input type="hidden" name="organization_id" value={data.organization.id} />
      <input type="hidden" name="pursuit_id" value={pursuitId} />
      <input type="hidden" name="record_id" value={saved?.id ?? ''} />
      <input type="hidden" name="version" value={snapshot.version} />
      <input type="hidden" name="content" value={JSON.stringify(draft)} />
      {changed && (
        <p role="status">
          Sources changed since this draft was saved. Retained answers need another review against
          the current wording below. Answers whose requirements were removed are not carried into
          this edit.
        </p>
      )}
      <p>
        This draft is shared with workspace members. Keep restricted information out of free-text
        answers. Current approved workspace-visible evidence is added separately during export; it
        is never silently copied into your narrative.
      </p>
      <fieldset disabled={pending || state.success}>
        <legend>{draft.kind} response draft</legend>
        <label>
          Response type
          <select
            aria-label="Response type"
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as typeof draft.kind })}
          >
            <option>RFI</option>
            <option>RFP</option>
            <option>RFQ</option>
          </select>
        </label>
        <label>
          Draft name
          <input
            name="title"
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Response overview
          <textarea
            rows={5}
            aria-label="Response overview"
            maxLength={6000}
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          />
        </label>
        {draft.answers.map((answer, index) => {
          const requirement = data.requirements?.find(
            (r) => r.id === answer.requirementId && r.pursuit_id === pursuitId,
          );
          return (
            <section key={answer.requirementId} className="panel">
              <h3>
                {index + 1}. {requirement?.requirement}
              </h3>
              <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                Source: {requirement?.citation ?? 'Not recorded'}
              </p>
              <label>
                Response to requirement {index + 1}
                <textarea
                  rows={5}
                  aria-label={`Response to requirement ${index + 1}`}
                  maxLength={4000}
                  value={answer.text}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      answers: draft.answers.map((a) =>
                        a.requirementId === answer.requirementId
                          ? { ...a, text: e.target.value }
                          : a,
                      ),
                    })
                  }
                />
              </label>
            </section>
          );
        })}
        {changed && (
          <label>
            <input type="checkbox" required /> I reconciled these answers with the changed source
            requirements.
          </label>
        )}
        <button className="button primary" type="submit">
          {pending ? 'Saving…' : `Save ${draft.kind} draft`}
        </button>
      </fieldset>
      <p role="status">{state.message}</p>
      {state.success && (
        <button className="button secondary" type="button" onClick={() => window.location.reload()}>
          Open saved response packages
        </button>
      )}
    </form>
  );
}
export default function ResponsePackages({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canEdit = ['organization_admin', 'capture_manager'].includes(data.organization.role);
  const packages = data.responsePackages ?? [];
  async function download(saved: SavedResponsePackage, format: 'pdf' | 'docx') {
    setBusy(true);
    setError('');
    try {
      const query = new URLSearchParams({
        organization: data.organization.id,
        pursuit: pursuitId,
        package: saved.id,
        version: saved.updated_at,
        format,
      });
      const response = await fetch(`/api/response-packages/export?${query}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: 'The export could not complete. Please retry.' }));
        throw new Error(body.message || 'Export unavailable.');
      }
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `bidxchange-response-draft.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'TimeoutError'
          ? 'The export timed out. Try again or reduce the package size.'
          : e instanceof Error
            ? e.message
            : 'Export unavailable.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" id="response-packages" aria-labelledby="response-packages-heading">
      <div className="eyebrow">Prepare your response</div>
      <h2 id="response-packages-heading">Response packages</h2>
      <p>
        Build a working response from this pursuit’s requirements. Saved PDFs and editable Word
        files include a cover, your answers, source references, approved company evidence and an
        internal review checklist. Every export is marked Draft; final document approval and
        submission are separate.
      </p>
      {packages.length > 20 && (
        <p role="status">Showing the 20 most recently updated response packages.</p>
      )}
      <AutofillPreview data={data} pursuitId={pursuitId} />
      {!packages.length && <p>No saved response packages yet.</p>}
      {packages.slice(0, 20).map((saved) => (
        <article key={saved.id} id={`response-${saved.id}`} className="panel">
          <h3>{saved.title}</h3>
          <p>Saved {saved.updated_at} · Draft</p>
          {readResponseDraft(saved.content) ? (
            <div className="hero-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void download(saved, 'pdf')}
              >
                Download saved draft PDF
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void download(saved, 'docx')}
              >
                Download saved draft Word
              </button>
              {canEdit && (
                <button className="button secondary" onClick={() => setEditing(saved.id)}>
                  Edit this draft
                </button>
              )}
            </div>
          ) : (
            <p>This saved section is not a supported response-package draft.</p>
          )}
        </article>
      ))}
      <p role="status">{busy ? 'Preparing your saved draft…' : error}</p>
      {canEdit && (data.requirements?.length ?? 0) <= 100 && (
        <button className="button primary" onClick={() => setEditing('new')}>
          Create response draft
        </button>
      )}
      {(data.requirements?.length ?? 0) > 100 && (
        <p>
          This composer supports up to 100 requirements per pursuit. Review the package scope before
          drafting.
        </p>
      )}
      {editing && canEdit && (
        <div>
          <p>
            Downloads use saved answers, with evidence checked again at export. Save your edits
            before downloading.
          </p>
          <Editor
            key={editing}
            data={data}
            pursuitId={pursuitId}
            saved={packages.find((p) => p.id === editing)}
          />
        </div>
      )}
    </section>
  );
}
