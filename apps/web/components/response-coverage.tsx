'use client';

import { useState } from 'react';
import type { TenantData } from '../lib/tenant-types';
import type { ResponseDraft } from '../lib/response-package';
import { responseCoverage } from '../lib/response-coverage';

export default function ResponseCoverage({
  data,
  pursuitId,
  draft,
  onEdit,
}: {
  data: TenantData;
  pursuitId: string;
  draft: ResponseDraft;
  onEdit?: (field: string) => void;
}) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const coverage = responseCoverage(data, pursuitId, draft);
  const attention = coverage.rows.filter((r) => r.needsAttention).length;
  const rows = coverage.rows.filter(
    (r) =>
      (filter === 'all' || r.needsAttention) &&
      `${r.requirement.requirement} ${r.requirement.citation ?? ''} ${r.answer}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <section aria-label="Response coverage matrix">
      <h4>Requirement-to-answer coverage</h4>
      <p>
        {attention} of {coverage.rows.length} loaded requirements need attention. Evidence counts
        are current review records, not proof that an answer meets the buyer’s instructions.
      </p>
      {coverage.partial && (
        <p role="status">
          This is a partial register. Review the full notice and records before relying on these
          counts.
        </p>
      )}
      {coverage.contextChanged && (
        <p role="status">
          Source or review context changed or is unavailable. Recheck every answer before freezing
          this response.
        </p>
      )}
      <div className="form-grid">
        <label>
          Find a requirement, citation or answer
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          Show requirements
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All recorded requirements</option>
            <option value="attention">Needs attention</option>
          </select>
        </label>
      </div>
      <p role="status">
        Showing {rows.length} of {coverage.rows.length} loaded requirements.
      </p>
      {!rows.length && (
        <p>
          {coverage.rows.length
            ? 'No requirements match these filters.'
            : 'Add the notice requirements to begin reviewing coverage.'}
        </p>
      )}
      {rows.map((row) => (
        <details key={row.requirement.id} className="panel">
          <summary>
            {row.requirement.requirement} —{' '}
            {row.needsAttention ? 'Review needed' : 'No automatic gaps detected'}
          </summary>
          <p>
            <strong>Notice citation:</strong> {row.requirement.citation || 'Not recorded'}
          </p>
          <p>
            <strong>Review owner:</strong>{' '}
            {row.requirement.owner_user_id ? 'Assigned in requirement register' : 'Unassigned'}
          </p>
          <p>
            <strong>Evidence reviews:</strong>{' '}
            {data.evidenceReviewsEnabled
              ? `${row.approved} current; ${row.stale} previously approved and now stale`
              : 'Not available'}
          </p>
          {row.issues.length > 0 && (
            <ul>
              {row.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          <h5>Saved answer</h5>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {row.answer || 'No answer saved.'}
          </p>
          {onEdit && (
            <button
              type="button"
              className="button secondary"
              onClick={() => onEdit(row.requirement.id)}
            >
              Edit this answer
            </button>
          )}
        </details>
      ))}
    </section>
  );
}
