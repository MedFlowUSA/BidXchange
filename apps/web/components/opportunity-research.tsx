'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ResearchPlan, ResearchReport } from '../lib/research/contracts';
import styles from './qualification-workspace.module.css';
type Saved = { id: string; name: string; prompt: string; plan: ResearchPlan };
export default function OpportunityResearch({ org, name }: { org: string; name: string }) {
  const [prompt, setPrompt] = useState('');
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [previous, setPrevious] = useState<ResearchPlan | null>(null);
  const [submitted, setSubmitted] = useState('');
  const [saving, setSaving] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endpoint = '/api/assistant/research';
  async function loadSaved(signal?: AbortSignal) {
    const response = await fetch(`${endpoint}/searches?organizationId=${org}`, {
      cache: 'no-store',
      signal,
    });
    if (!response.ok) throw new Error('Saved searches are unavailable.');
    setSaved((await response.json()).searches);
  }
  useEffect(() => {
    const controller = new AbortController();
    loadSaved(controller.signal).catch(() => {
      if (!controller.signal.aborted) setMessage('Saved searches could not be loaded.');
    });
    return () => {
      controller.abort();
      abort.current?.abort();
    };
    // This component is keyed by organization at the server boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);
  async function ask(question = prompt, base = previous) {
    if (pending || !question.trim()) return;
    setPending(true);
    setMessage('Interpreting filters and checking authorized records…');
    abort.current = new AbortController();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.current.signal,
        body: JSON.stringify({
          organizationId: org,
          requestId: crypto.randomUUID(),
          prompt: question,
          previousPlan: base,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Research unavailable.');
      setReport(payload.report);
      setPrevious(payload.report.plan);
      setSubmitted(question);
      setHistory((current) => [...current.slice(-4), question]);
      setMessage('Research complete. Review the interpreted filters and limitations below.');
    } catch (error) {
      setMessage(
        error instanceof Error && error.name === 'AbortError'
          ? 'Research cancelled.'
          : error instanceof Error
            ? error.message
            : 'Research unavailable.',
      );
    } finally {
      setPending(false);
    }
  }
  async function save() {
    if (!report || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`${endpoint}/searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: org,
          name: submitted.slice(0, 120),
          prompt: submitted,
          plan: report.plan,
        }),
      });
      if (!response.ok) throw new Error();
      await loadSaved();
      setMessage('Saved to your personal searches. Scheduling and notifications are not enabled.');
    } catch {
      setMessage('Could not save this search.');
    } finally {
      setSaving(false);
    }
  }
  async function remove(id: string) {
    const response = await fetch(`${endpoint}/searches`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: org, id }),
    });
    if (response.ok) {
      setSaved((current) => current.filter((s) => s.id !== id));
      setMessage('Saved search removed.');
    } else setMessage('Could not remove this search.');
  }
  return (
    <div className={styles.workspace}>
      <section className="panel">
        <div className="eyebrow">Opportunity research · {name}</div>
        <h1>Find the next opportunity worth reviewing.</h1>
        <p>
          Ask a question, then refine the filters in a follow-up. Results come from saved workspace
          records and authorized synchronized source records when available. Company comparison uses
          current verified evidence visible to your role.
        </p>
        <nav className={styles.links}>
          <Link href={`/assistant?organization=${org}`}>General and company assistant</Link>
          <Link href={`/opportunities/registry?organization=${org}`}>
            Portals and connection status
          </Link>
        </nav>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
          className="opportunity-form"
        >
          <label htmlFor="research-question">What work are you looking for?</label>
          <textarea
            id="research-question"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            required
            maxLength={3000}
            rows={4}
            disabled={pending}
          />
          <div className={styles.links}>
            <button className="button primary" disabled={pending}>
              {pending ? 'Researching…' : 'Research opportunities'}
            </button>
            {pending ? (
              <button type="button" onClick={() => abort.current?.abort()}>
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPrevious(null);
                  setReport(null);
                  setHistory([]);
                  setSubmitted('');
                  setMessage('Started a new search.');
                }}
              >
                New search
              </button>
            )}
          </div>
        </form>
        <p role="status">{message}</p>
        <div className={styles.links}>
          {[
            'Are there new SAM.gov contracts that fit our company?',
            'What opportunities were posted today?',
            'Find electrical and energy-efficiency work',
            'What changed in tracked opportunities?',
          ].map((q) => (
            <button type="button" key={q} disabled={pending} onClick={() => setPrompt(q)}>
              {q}
            </button>
          ))}
        </div>
        {history.length > 0 && (
          <details>
            <summary>Recent questions in this tab</summary>
            <ol>
              {history.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
            <p>
              Follow-ups reuse the last filter plan. Earlier answers are snapshots. Reloading clears
              this conversation.
            </p>
          </details>
        )}
      </section>
      <section className="panel">
        <h2>Your saved searches</h2>
        <p>Run on demand. Scheduled searches and outbound notifications are not active.</p>
        {!saved.length ? (
          <p>No saved searches yet.</p>
        ) : (
          <ul>
            {saved.map((s) => (
              <li key={s.id}>
                {s.name}{' '}
                <button
                  disabled={pending}
                  onClick={() => {
                    setPrompt(s.prompt);
                    void ask(s.prompt, s.plan);
                  }}
                >
                  Run saved search
                </button>{' '}
                <button onClick={() => void remove(s.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {report && (
        <>
          <section className="panel">
            <h2>Research scope and filters</h2>
            <p>
              {report.sources.length} record sources searched · {report.reviewed} opportunities
              reviewed · {report.matched} potential matches · showing {report.results.length}.
            </p>
            <p>
              Checked {report.checkedAt}.{' '}
              {report.partial
                ? 'Partial snapshot: a record limit was reached. Narrowing the question may still miss older records outside this snapshot.'
                : 'Bounded authorized snapshot; this is not an exhaustive procurement-market search.'}
            </p>
            <ul>
              {report.sources.map((s) => (
                <li key={s.id}>
                  {s.id}: {s.status}. Last successful source sync:{' '}
                  {s.lastSuccess ?? 'None recorded'}.
                </li>
              ))}
            </ul>
            <details open>
              <summary>AI-interpreted filters — correct these with a follow-up</summary>
              <dl>
                {Object.entries(report.plan)
                  .filter(([, v]) => v !== null && (!Array.isArray(v) || v.length))
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
                    </div>
                  ))}
              </dl>
            </details>
            <button disabled={saving || pending} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save this search'}
            </button>
            <ul>
              {report.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <details>
              <summary>Company information still needed</summary>
              <ul>
                {report.missingCompany.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <Link href={`/company?organization=${org}`}>Review Company Passport</Link>
            </details>
          </section>
          {!report.results.length && (
            <section className="panel">
              <h2>No results in the available records</h2>
              <p>
                This does not mean no opportunities exist. Check source activation, synchronization
                coverage, and your filters.
              </p>
            </section>
          )}
          {report.results.map((r, index) => (
            <article className="panel" key={`${r.notice.source}:${r.notice.id}`}>
              <h2>
                {index + 1}. {r.notice.title}
              </h2>
              <p>
                {r.notice.agency ?? 'Agency unknown'} · {r.notice.status}
              </p>
              <p>
                Published: {r.notice.published ?? 'Unknown'} · Response deadline:{' '}
                {r.notice.deadline ?? 'Unknown'}
                <br />
                Last synchronized: {r.notice.synchronizedAt ??
                  'Not synchronized; workspace entry'}{' '}
                · Version: {r.notice.version}
              </p>
              {r.notice.blockers.length > 0 && (
                <div className="info-note">
                  <strong>Recorded blockers — do not advance on match relevance alone.</strong>
                  <ul>
                    {r.notice.blockers.map((b) => (
                      <li key={b.href}>
                        <Link href={b.href}>{b.requirement}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <details open>
                <summary>Explain this match</summary>
                <p>
                  Each displayed component earns one relevance point. Code overlap is ordered ahead
                  of filter matches; unknown requested fields and recorded blockers reduce priority.
                  These points do not establish qualification or profit.
                </p>
                <ul>
                  {r.matches.map((m) => (
                    <li key={m.component}>
                      {m.component}: {m.points}
                      {m.evidenceIds.map((id) => (
                        <span key={id}>
                          {' '}
                          ·{' '}
                          <Link href={`/company?organization=${org}#fact-${id}`}>
                            Company evidence
                          </Link>
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                {r.unknownFilters.length > 0 && (
                  <p>Unverified filter matches: {r.unknownFilters.join(', ')}.</p>
                )}
              </details>
              <details>
                <summary>Qualification gaps and human review</summary>
                <ul>
                  {r.qualification.map((q, i) => (
                    <li key={i}>
                      <strong>
                        {q.area}: {q.status}.
                      </strong>{' '}
                      {q.reason}
                    </li>
                  ))}
                </ul>
              </details>
              {r.notice.changedFields.length > 0 && (
                <p>
                  Observed changed fields: {r.notice.changedFields.join(', ')}. Review the source
                  versions before updating your response.
                </p>
              )}
              <p>
                Attachments: {r.notice.attachments ?? 'Unknown'}; not analyzed. No attachment or
                page-level conclusions are available.
              </p>
              <p>
                <strong>Next action:</strong> {r.nextAction}
              </p>
              <nav className={styles.links}>
                {r.notice.sourceUrl ? (
                  <a href={r.notice.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Open source notice ↗
                  </a>
                ) : (
                  <span>
                    Official source URL unavailable — verify before relying on this record.
                  </span>
                )}
                <Link href={r.notice.workspaceUrl}>
                  {r.notice.source === 'workspace'
                    ? 'Open opportunity and pursuit tools'
                    : 'Review source inbox and add to pipeline'}
                </Link>
              </nav>
            </article>
          ))}
        </>
      )}
    </div>
  );
}
