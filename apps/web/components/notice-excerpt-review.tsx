'use client';
import { useState } from 'react';
import { noticeCandidates } from '../lib/notice-excerpt';
import type { TenantData } from '../lib/tenant-types';
import { RequirementForm } from './capture-forms';
import { californiaSuggestions, californiaRulesVersion } from '../lib/california-rules';

export default function NoticeExcerptReview({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const [source, setSource] = useState('');
  const [location, setLocation] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [result, setResult] = useState<ReturnType<typeof noticeCandidates> | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);
  return (
    <section className="panel" id="notice-intake" aria-labelledby="notice-intake-heading">
      <div className="eyebrow">1 · Read the notice</div>
      <h2 id="notice-intake-heading">Turn source wording into reviewable requirements</h2>
      <p>
        Candidate requirements may be incomplete or inaccurate until a person reviews and signs off
        on the Requirements Register.
      </p>
      <p>
        Paste public notice text from one page or section. This local text helper highlights lines
        containing obligation words such as “must” or “shall”; it does not interpret the whole
        solicitation or use AI. Nothing is saved until you review and add a requirement.
      </p>
      <form
        className="opportunity-form admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setResult(noticeCandidates(source, location, excerpt));
            setError('');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Check the excerpt.');
          }
        }}
      >
        <fieldset disabled={Boolean(result)}>
          <legend>Public notice excerpt</legend>
          <label>
            Notice title and version
            <input
              required
              maxLength={300}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </label>
          <label>
            Page or section
            <input
              required
              maxLength={120}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label>
            Source text
            <textarea
              required
              maxLength={24000}
              rows={8}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
            />
          </label>
          <p>
            Keep each obligation and its conditions together on one line. Do not paste restricted
            company information. The full excerpt stays in this tab; saving a requirement shares its
            citation and quoted line with workspace members.
          </p>
          <button className="button secondary" type="submit">
            Find possible requirements
          </button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <details>
            <summary>California contractor checklist suggestions</summary>
            <p>
              Checklist heuristics—not a legal or licensing determination. Version:{' '}
              {californiaRulesVersion}. Dismissals remain in this tab until the excerpt is reset.
            </p>
            {californiaSuggestions(excerpt)
              .filter((s) => !dismissed.includes(s.id))
              .map((s) => (
                <div className="panel" key={s.id}>
                  <h3>{s.category} · candidate</h3>
                  <blockquote>{s.quote}</blockquote>
                  <p>
                    Pasted line {s.line} · Confidence: {s.confidence} · Mandatory language detected:{' '}
                    {s.mandatoryCandidate ? 'yes, review context' : 'not detected'}
                  </p>
                  <p>{s.explanation}</p>
                  <RequirementForm
                    data={data}
                    pursuitId={pursuitId}
                    sourceDraft={{
                      requirement: s.explanation,
                      citation: `${source} — ${location}, pasted line ${s.line}\nRule ${s.rule} / ${s.version}. Candidate only.\nSource quotation: ${s.quote}`,
                    }}
                  />
                  <button
                    className="button secondary"
                    onClick={() => setDismissed((d) => [...d, s.id])}
                  >
                    Dismiss suggestion
                  </button>
                </div>
              ))}
          </details>
          <p role="status">
            {result.candidates.length} possible requirements. Review context, exceptions and
            cross-references in the original notice. This is not a complete requirements list.
          </p>
          {result.omitted > 0 && (
            <p role="status">
              {result.omitted} matching lines were omitted because they exceeded 1,200 characters or
              the 20-candidate limit. Review those lines manually.
            </p>
          )}
          {!result.candidates.length && (
            <p>
              No matching lines found. Requirements may still be present. Use Add requirement below
              to record them manually.
            </p>
          )}
          {result.candidates.map((candidate) => (
            <article className="panel" key={`${revision}:${candidate.line}`}>
              <h3>Possible requirement · pasted line {candidate.line}</h3>
              <blockquote style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {candidate.text}
              </blockquote>
              <p>
                Source: {source} · {location}
              </p>
              {(data.requirements ?? []).some(
                (r) => r.pursuit_id === pursuitId && r.requirement.trim() === candidate.text,
              ) ? (
                <p>
                  Matching requirement text is already in this pursuit. Check its existing citation
                  and review before adding another.
                </p>
              ) : (
                <RequirementForm
                  data={data}
                  pursuitId={pursuitId}
                  sourceDraft={{ requirement: candidate.text, citation: candidate.citation }}
                />
              )}
            </article>
          ))}
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setResult(null);
              setDismissed([]);
              setRevision((r) => r + 1);
            }}
          >
            Edit excerpt and discard unsaved drafts
          </button>
        </>
      )}
    </section>
  );
}
