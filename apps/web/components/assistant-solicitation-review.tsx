'use client';
import { useEffect, useRef, useState } from 'react';
import type { TenantData } from '../lib/tenant-types';
import type { Answer } from '../lib/ai/contracts';
import { solicitationInputSchema, solicitationTextLimit } from '../lib/ai/solicitation-contracts';
import { RequirementForm } from './capture-forms';
import styles from './assistant.module.css';

export default function AssistantSolicitationReview({
  data,
  pursuitId,
  disabled,
  onBusy,
}: {
  data: TenantData;
  pursuitId: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [title, setTitle] = useState(''),
    [url, setUrl] = useState(''),
    [text, setText] = useState('');
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null),
    [dismissed, setDismissed] = useState<number[]>([]);
  const [revision, setRevision] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const clear = () => {
      controller.current?.abort();
      setText('');
      setTitle('');
      setUrl('');
      setConsent(false);
      setAnswer(null);
    };
    window.addEventListener('pagehide', clear);
    return () => {
      controller.current?.abort();
      window.removeEventListener('pagehide', clear);
    };
  }, []);
  async function review() {
    if (busy || disabled) return;
    const parsed = solicitationInputSchema.safeParse({ title, url, text, consent });
    if (!parsed.success) {
      setError(
        'Enter a title/version, valid optional HTTPS URL and 20–40,000 characters of public text, then confirm sharing. Long input is not shortened.',
      );
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          organizationId: data.organization.id,
          requestId: crypto.randomUUID(),
          context: { kind: 'pursuit', id: pursuitId },
          mode: 'workspace',
          prompt:
            'Review the supplied solicitation text. Identify source-quoted candidate requirements, compare them with authorized company records, and suggest human follow-up.',
          solicitation: parsed.data,
        }),
      });
      if (!response.ok) {
        const failure = await response.json();
        throw Error(failure.message ?? 'The review could not be completed.');
      }
      const reader = response.body?.getReader();
      if (!reader) throw Error('No review received.');
      const decoder = new TextDecoder();
      let buffer = '',
        result: Answer | undefined;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === 'error') throw Error(event.message);
          if (event.type === 'answer') result = event.answer;
        }
      }
      if (abort.signal.aborted) return;
      if (!result?.solicitationReview)
        throw Error('No validated review arrived. Your text is kept so you can retry.');
      setAnswer(result);
      setDismissed([]);
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Review unavailable.');
    } finally {
      if (!abort.signal.aborted) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  const result = answer?.solicitationReview;
  return (
    <details className={styles.planCard}>
      <summary>Review solicitation text</summary>
      <p>
        Paste public notice text to find candidate requirements and compare them with this company’s
        records. Only the text you provide is reviewed; attached files and linked pages are not
        fetched.
      </p>
      <p>
        Up to {solicitationTextLimit.toLocaleString()} characters and 16 candidates per review. AI
        may miss requirements. This does not approve the register or decide whether to bid.
      </p>
      <form
        className="opportunity-form admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          void review();
        }}
      >
        <fieldset disabled={disabled || busy || !!result}>
          <legend>Source to review</legend>
          <label>
            Notice title and version
            <input
              required
              maxLength={160}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setConsent(false);
              }}
            />
          </label>
          <label>
            Official source URL (optional)
            <input
              type="url"
              maxLength={500}
              placeholder="https://"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setConsent(false);
              }}
            />
          </label>
          <label>
            Solicitation text
            <textarea
              rows={10}
              required
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setConsent(false);
              }}
            />
          </label>
          <p>
            {text.length.toLocaleString()} / {solicitationTextLimit.toLocaleString()} characters.
            Line references refer to pasted text, not PDF pages.
          </p>
          <details>
            <summary>Preview exactly what will be shared</summary>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</pre>
          </details>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{' '}
            I reviewed this public solicitation text and am authorized to share it with AI.
          </label>
          <p>
            Exclude confidential material. The unsaved text and review stay in this tab and are not
            included in saved BidBuddy conversations. AI processing occurs when you click Review.
          </p>
          <button
            className="button primary"
            disabled={!consent || text.length < 20 || text.length > solicitationTextLimit}
          >
            Review solicitation
          </button>
        </fieldset>
      </form>
      {busy && (
        <>
          <p role="status">Reviewing supplied text and company records…</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
              onBusy(false);
              setError('Review cancelled. Your text has been kept.');
            }}
          >
            Cancel review
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {result && (
        <section aria-label="Solicitation review results">
          <h3>Candidate requirements to review</h3>
          <p>
            {result.title}
            {result.url && (
              <>
                {' '}
                ·{' '}
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  Official source (external)
                </a>
              </>
            )}
          </p>
          {answer?.recordsCheckedAt && (
            <p>
              Company records checked {new Date(answer.recordsCheckedAt).toLocaleString()}. Later
              changes require a new review.
            </p>
          )}
          <p>
            AI suggestions from {result.characters.toLocaleString()} characters / {result.lines}{' '}
            pasted lines. {result.candidates.length} candidates returned; this is not a complete
            requirements checklist.
          </p>
          <p>
            Company retrieval is bounded. Missing evidence in these results does not prove the
            company lacks a qualification. Compare interpretations with the original solicitation
            and its attachments.
          </p>
          {result.candidates.length === 16 && (
            <p role="status">
              The 16-candidate limit was reached. Review the remaining source sections separately.
            </p>
          )}
          {!result.candidates.length && (
            <p>
              No source-backed candidates were returned. Review the source manually; requirements
              may still be present.
            </p>
          )}
          <ul>
            {result.limitations.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          {result.candidates.map((candidate, index) => (
            <article key={`${revision}:${index}`} className={styles.planCard}>
              <h4>
                {candidate.category} · pasted lines {candidate.lineStart}–{candidate.lineEnd}
              </h4>
              {dismissed.includes(index) ? (
                <>
                  <p>Candidate dismissed; nothing was saved.</p>
                  <button
                    className="text-button"
                    onClick={() => setDismissed((old) => old.filter((i) => i !== index))}
                  >
                    Restore candidate
                  </button>
                </>
              ) : (
                <>
                  <blockquote style={{ whiteSpace: 'pre-wrap' }}>{candidate.quote}</blockquote>
                  {candidate.occurrences > 1 && (
                    <p>
                      This quotation appears more than once. The line reference identifies its first
                      occurrence.
                    </p>
                  )}
                  <p>
                    <strong>What it asks:</strong> {candidate.meaning}
                  </p>
                  <p>
                    <strong>
                      {candidate.assessment === 'records_found'
                        ? 'Related records found; human review needed'
                        : candidate.assessment === 'needs_evidence'
                          ? 'Evidence follow-up'
                          : 'Clarification needed'}
                      :
                    </strong>{' '}
                    {candidate.comparison}
                  </p>
                  <p>
                    <strong>Suggested next step:</strong> {candidate.nextStep}
                  </p>
                  <ul>
                    {candidate.companySources.map((key) => {
                      const citation = answer?.citations.find((c) => c.key === key);
                      return citation ? (
                        <li key={key}>
                          {citation.href ? (
                            <a href={citation.href}>{citation.title}</a>
                          ) : (
                            citation.title
                          )}{' '}
                          · {citation.status.replaceAll('_', ' ')}
                        </li>
                      ) : null;
                    })}
                  </ul>
                  {(data.requirements ?? []).some(
                    (r) =>
                      r.pursuit_id === pursuitId && r.requirement.trim() === candidate.quote.trim(),
                  ) ? (
                    <p>
                      This exact wording is already in the register. Review its existing record
                      before adding another.
                    </p>
                  ) : (
                    <RequirementForm
                      data={data}
                      pursuitId={pursuitId}
                      sourceDraft={{ requirement: candidate.quote, citation: candidate.citation }}
                    />
                  )}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setDismissed((old) => [...old, index])}
                  >
                    Dismiss candidate
                  </button>
                </>
              )}
            </article>
          ))}
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setAnswer(null);
              setConsent(false);
              setDismissed([]);
              setRevision((old) => old + 1);
            }}
          >
            Edit text and discard unsaved review
          </button>
        </section>
      )}
    </details>
  );
}
