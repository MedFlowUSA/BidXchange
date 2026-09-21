'use client';
import { useState } from 'react';
import type { TenantData } from '../lib/tenant-types';
import {
  readResponseDraft,
  responseDocument,
  type SavedResponsePackage,
} from '../lib/response-package';
import { responseProgress } from '../lib/response-progress';

export default function ResponseReview({
  data,
  pursuitId,
  saved,
  onEdit,
}: {
  data: TenantData;
  pursuitId: string;
  saved: SavedResponsePackage;
  onEdit?: (field: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const draft = readResponseDraft(saved.content);
  if (!draft) return null;
  const progress = responseProgress(draft, data, pursuitId);
  let document;
  let error = '';
  if (open) {
    try {
      document = responseDocument(data, pursuitId, saved, new Date(data.reviewAsOf));
    } catch (e) {
      error = e instanceof Error ? e.message : 'Review unavailable. Reload before exporting.';
    }
  }
  return (
    <section aria-label="Saved draft review" style={{ overflowWrap: 'anywhere' }}>
      <p>
        <strong>
          {progress.current} of {progress.rows.length}
        </strong>{' '}
        requirement answers drafted against current wording.
      </p>
      <button
        type="button"
        className="button secondary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Hide draft review' : 'Review saved draft'}
      </button>
      {open && (
        <div>
          <p>
            Checks apply to the saved draft and loaded records. Written answers still require human
            review; these counts do not establish compliance or approval.
          </p>
          {error ? (
            <p role="alert">{error}</p>
          ) : (
            <>
              {(progress.overviewMissing || progress.overviewPlaceholder) && (
                <p>
                  Overview: {progress.overviewMissing ? 'missing' : 'unfinished placeholders'}.{' '}
                  {onEdit && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onEdit('overview')}
                    >
                      Edit overview
                    </button>
                  )}
                </p>
              )}
              {!progress.rows.length && (
                <p>No requirements recorded. Review the notice and add its requirements first.</p>
              )}
              <ul>
                {progress.rows
                  .filter((r) => r.missing || r.placeholder || r.changed)
                  .map((r) => (
                    <li key={r.id}>
                      <strong>{r.title}</strong> —{' '}
                      {[
                        r.missing && 'answer missing',
                        r.placeholder && 'unfinished placeholders',
                        r.changed && 'source wording changed',
                      ]
                        .filter(Boolean)
                        .join('; ')}
                      .
                      {onEdit && (
                        <button type="button" className="text-button" onClick={() => onEdit(r.id)}>
                          Review this answer
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
              {!!progress.removed && (
                <p>
                  {progress.removed} saved answers refer to removed or unavailable requirements.
                  Reconcile them before use.
                </p>
              )}
              <h4>Document review checklist</h4>
              {document?.reviewIssues?.length ? (
                <ul>
                  {document.reviewIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  No automatic gaps detected. Check source completeness and obtain final document
                  approval before use.
                </p>
              )}
              <details>
                <summary>Read complete saved draft</summary>
                <h4>{document?.title}</h4>
                <p>{document?.draftName} · Draft</p>
                {document?.blocks.map((block, i) =>
                  block.kind === 'heading' ? (
                    <h4 key={i}>{block.text}</h4>
                  ) : (
                    <p key={i} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {block.text}
                    </p>
                  ),
                )}
              </details>
            </>
          )}
        </div>
      )}
    </section>
  );
}
