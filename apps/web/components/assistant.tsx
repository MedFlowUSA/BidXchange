'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FEED_NOTICE, type Answer, type AssistantContext } from '../lib/ai/contracts';
import styles from './assistant.module.css';
import { evidenceLabel, evidenceValue } from '../lib/ai/display';
import { responseCommand } from '../lib/response-command';
import { createAssistantDocument } from '../app/assistant-document-actions';
import { workspaceHref } from '../lib/routes';
type Conversation = {
  id: string;
  question: string;
  answer?: Answer;
  requestId?: string;
  document?: { message: string; href?: string };
};
export default function Assistant({
  organizationId,
  name,
  context = null,
  demo = false,
  demoEnabled = false,
  expanded = false,
}: {
  organizationId?: string;
  name: string;
  context?: AssistantContext | null;
  demo?: boolean;
  demoEnabled?: boolean;
  expanded?: boolean;
}) {
  const [open, setOpen] = useState(expanded),
    [available, setAvailable] = useState(demo && demoEnabled),
    [checking, setChecking] = useState(!demo);
  const [prompt, setPrompt] = useState(''),
    [conversations, setConversations] = useState<Conversation[]>([]),
    [active, setActive] = useState<string | null>(null);
  const [mode, setMode] = useState<'general' | 'workspace'>('general');
  const [pending, setPending] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [feedback, setFeedback] = useState('');
  const controller = useRef<AbortController | null>(null);
  const access = useRef<string | null>(null);
  const actionLock = useRef(false);
  const documentRequest = useRef<{ question: string; id: string } | null>(null);
  const selected = conversations.find((c) => c.id === active);
  const questions =
    !demo && mode === 'general'
      ? [
          'Explain how a bid bond works.',
          'Help me write a professional follow-up email.',
          'Brainstorm ways to improve our estimating process.',
        ]
      : context?.kind === 'pursuit'
        ? ['Summarize this pursuit.', 'What tasks are overdue?']
        : context
          ? ['Why should we review this opportunity?', 'What could disqualify us?']
          : [
              `What information needs verification for ${name}?`,
              'Which opportunities are due in the next 14 days?',
              'What new opportunities were added today?',
            ];
  useEffect(() => {
    if (demo) return;
    const abort = new AbortController();
    const clear = () => {
      controller.current?.abort();
      setConversations([]);
      setActive(null);
      setPrompt('');
      documentRequest.current = null;
    };
    const check = () =>
      fetch(`/api/assistant/status?organization=${encodeURIComponent(organizationId ?? '')}`, {
        signal: abort.signal,
        cache: 'no-store',
      })
        .then((r) => r.json())
        .then((result) => {
          const next = result.access ?? null;
          if (!result.available || (access.current !== null && access.current !== next)) clear();
          access.current = next;
          setAvailable(result.available === true);
          setChecking(false);
        })
        .catch(() => {
          if (!abort.signal.aborted) {
            clear();
            setAvailable(false);
            setChecking(false);
          }
        });
    void check();
    const timer = setInterval(() => void check(), 15000);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
      abort.abort();
      controller.current?.abort();
    };
  }, [organizationId, demo]);
  // Clear confidential tab memory on page suspension/navigation; nothing enters browser storage.
  useEffect(() => {
    const clear = () => {
      controller.current?.abort();
      setConversations([]);
      setActive(null);
      setPrompt('');
      documentRequest.current = null;
    };
    window.addEventListener('pagehide', clear);
    return () => window.removeEventListener('pagehide', clear);
  }, []);
  async function ask(question = prompt, retry = false) {
    if (pending || actionLock.current || !question.trim() || !available) return;
    actionLock.current = true;
    setError('');
    setFeedback('');
    setPending(true);
    setStatus('Starting…');
    const id = crypto.randomUUID();
    setActive(id);
    setConversations((old) => [...old.slice(-9), { id, question, requestId: id }]);
    const abort = new AbortController();
    controller.current = abort;
    try {
      if (!demo && responseCommand(question)) {
        setStatus('Preparing a response draft from this pursuit…');
        if (context?.kind !== 'pursuit') {
          setConversations((old) =>
            old.map((c) =>
              c.id === id
                ? {
                    ...c,
                    document: {
                      message:
                        'Open the bid in Pursuits, then ask “Create an RFP for this bid”. The selected pursuit supplies the bid details and requirements.',
                      href: workspaceHref('/pursuits', organizationId),
                    },
                  }
                : c,
            ),
          );
          return;
        }
        if (!retry || documentRequest.current?.question !== question)
          documentRequest.current = { question, id };
        const result = await createAssistantDocument({
          organizationId,
          pursuitId: context.id,
          requestId: documentRequest.current!.id,
          prompt: question,
        });
        if (!result.href) throw new Error(result.message);
        setConversations((old) => old.map((c) => (c.id === id ? { ...c, document: result } : c)));
        return;
      }
      if (demo) {
        const answer: Answer = {
          answer: [
            {
              text: 'Fictional demonstration: Apex Energy Demo has sample opportunities for exploring review workflows.',
              sources: ['demo'],
            },
          ],
          risks: [
            'This is a predefined fictional answer, not a model response or real company assessment. Demo scoring never authorizes a bid.',
          ],
          nextAction:
            'Open the fictional opportunities and review their deterministic eligibility checks.',
          citations: [
            {
              key: 'demo',
              type: 'demo',
              title: 'Apex Energy Demo opportunities',
              id: 'demo',
              sourceDate: null,
              updatedAt: null,
              status: 'fictional',
              href: '/opportunities?workspace=demo',
            },
          ],
          evidence: [],
          notice: FEED_NOTICE,
        };
        setConversations((old) => old.map((c) => (c.id === id ? { ...c, answer } : c)));
        return;
      }
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          requestId: id,
          prompt: question,
          context: mode === 'general' ? null : context,
          mode,
        }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const failure = await response.json();
        throw new Error(failure.message ?? 'Assistant unavailable.');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response received.');
      const decoder = new TextDecoder();
      let buffer = '',
        received = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === 'status') setStatus(event.text);
          if (event.type === 'error') throw new Error(event.message);
          if (event.type === 'answer') {
            received = true;
            setConversations((old) =>
              old.map((c) => (c.id === id ? { ...c, answer: event.answer } : c)),
            );
          }
        }
      }
      if (!received)
        throw new Error('The stream ended before a verified answer arrived. Please retry.');
    } catch (error) {
      setError(
        abort.signal.aborted
          ? 'Generation cancelled.'
          : error instanceof Error
            ? error.message
            : 'Assistant unavailable.',
      );
    } finally {
      actionLock.current = false;
      setPending(false);
      setStatus('');
    }
  }
  async function rate(rating: string) {
    if (demo) {
      setFeedback('Fictional feedback selected; nothing was sent.');
      return;
    }
    try {
      const r = await fetch('/api/assistant/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, requestId: selected?.requestId, rating }),
      });
      const result = await r.json();
      setFeedback(
        result.saved ? 'Feedback saved.' : 'Feedback could not be saved or was already recorded.',
      );
    } catch {
      setFeedback('Feedback could not be saved.');
    }
  }
  return (
    <section className={`panel ${styles.panel}`} aria-label="Ask BidXchange">
      <div className={styles.heading}>
        <div>
          <div className="eyebrow">ASK BIDXCHANGE</div>
          <h2>Ask, explore, and get work moving.</h2>
          <p>
            {name} ·{' '}
            {demo
              ? 'Fictional scripted demonstration'
              : 'General questions and authorized workspace records'}
          </p>
        </div>
        <button className="button secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Collapse assistant' : 'Open assistant'}
        </button>
      </div>
      {open && (
        <>
          <p className="info-note">
            {FEED_NOTICE} AI-generated—verify important information. No approvals, pricing changes
            or submissions.
          </p>
          {!demo && (
            <p>
              General questions use no company records. Workspace records use authorized, classified
              evidence only. No live web browsing is available. Do not enter passwords or API keys.
            </p>
          )}
          {!demo && (
            <p>
              Document commands use the open pursuit in either mode. Ask “Create an RFP for this
              bid” to save a response outline with bid details and requirement sections. Complete
              and review the answers before exporting.
            </p>
          )}
          {checking ? (
            <p role="status">Checking assistant availability…</p>
          ) : !available ? (
            <p role="status">
              {demo
                ? 'The fictional scripted assistant is disabled. No paid AI is available in the public demo.'
                : 'AI is unavailable for this workspace. An operator must configure the model, credentials, usage limits and organization activation.'}
            </p>
          ) : null}
          <div className={styles.layout}>
            <aside aria-label="Conversations">
              <button
                className="button secondary"
                disabled={pending}
                onClick={() => {
                  setActive(null);
                  setPrompt('');
                  documentRequest.current = null;
                  setError('');
                  setFeedback('');
                }}
              >
                New conversation
              </button>
              <p>
                Private to this tab. Cleared on reload or workspace change. Questions are answered
                independently; include the context needed in each question.
              </p>
              {conversations.map((c, i) => (
                <button
                  className={styles.conversation}
                  key={c.id}
                  disabled={pending}
                  aria-pressed={c.id === active}
                  onClick={() => {
                    setActive(c.id);
                    setFeedback('');
                  }}
                >
                  {i + 1}. {c.question}
                </button>
              ))}
              <button
                className="text-button"
                disabled={pending}
                onClick={() => {
                  setConversations([]);
                  setActive(null);
                  setPrompt('');
                  documentRequest.current = null;
                  setError('');
                  setFeedback('');
                }}
              >
                Clear conversations
              </button>
            </aside>
            <div className={styles.content}>
              <div className={styles.suggestions}>
                {!demo && context?.kind === 'pursuit' && (
                  <button
                    className="button secondary"
                    disabled={pending}
                    onClick={() => setPrompt('Create an RFP for this bid')}
                  >
                    Create an RFP for this bid
                  </button>
                )}
                {questions.map((q) => (
                  <button
                    key={q}
                    className="button secondary"
                    disabled={pending}
                    onClick={() => setPrompt(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void ask();
                }}
              >
                {!demo && (
                  <label>
                    Answer mode
                    <select
                      aria-label="Answer mode"
                      value={mode}
                      disabled={pending}
                      onChange={(e) => setMode(e.target.value as 'general' | 'workspace')}
                    >
                      <option value="general">General questions</option>
                      <option value="workspace">Workspace records</option>
                    </select>
                  </label>
                )}
                <label htmlFor="assistant-question">
                  {!demo && mode === 'general' ? 'Ask a question' : `Ask about ${name}`}
                </label>
                <textarea
                  id="assistant-question"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  maxLength={3000}
                  rows={3}
                  required
                  disabled={pending || !available}
                />
                <div className={styles.actions}>
                  <button
                    className="button primary"
                    disabled={pending || !available || !prompt.trim()}
                  >
                    Ask BidXchange
                  </button>
                  {pending && !responseCommand(selected?.question ?? '') && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => controller.current?.abort()}
                    >
                      Cancel generation
                    </button>
                  )}
                </div>
              </form>
              <p role="status" aria-live="polite">
                {pending ? status : ''}
              </p>
              {error && (
                <div role="alert">
                  <p>{error}</p>
                  <button
                    className="button secondary"
                    disabled={pending || !available}
                    onClick={() => void ask(selected?.question ?? prompt, true)}
                  >
                    Retry
                  </button>
                </div>
              )}
              {selected?.document && (
                <article aria-label="Assistant document">
                  <h3>Response draft</h3>
                  <p>{selected.document.message}</p>
                  {selected.document.href && (
                    <a className="button primary" href={selected.document.href}>
                      Open response workspace
                    </a>
                  )}
                  <p>
                    Drafts need human review before use. Nothing has been approved or submitted.
                  </p>
                </article>
              )}
              {selected?.answer && (
                <article aria-label="Assistant answer">
                  <h3>{demo ? 'Fictional answer' : 'Assistant response'}</h3>
                  <p>{selected.answer.notice}</p>
                  <p>{selected.question}</p>
                  {selected.answer.answer.map((item, index) => (
                    <p key={index} style={{ whiteSpace: 'pre-wrap' }}>
                      {item.text}
                    </p>
                  ))}
                  {selected.answer.evidence.map((item) => (
                    <details key={item.citation.key} open>
                      <summary>
                        {item.citation.title} · {item.citation.status.replaceAll('_', ' ')}
                      </summary>
                      <dl>
                        {Object.entries(item.fields)
                          .filter(([key]) => key !== 'workspaceRoute')
                          .map(([key, value]) => (
                            <div key={key}>
                              <dt>{evidenceLabel(key)}</dt>
                              <dd>{evidenceValue(value)}</dd>
                            </div>
                          ))}
                      </dl>
                    </details>
                  ))}
                  {selected.answer.risks.length > 0 && <h3>Risks or missing information</h3>}
                  <ul>
                    {selected.answer.risks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  {selected.answer.nextAction && <h3>Recommended next action</h3>}
                  <p>{selected.answer.nextAction}</p>
                  {selected.answer.citations.length > 0 && <h3>Sources</h3>}
                  <ul>
                    {selected.answer.citations.map((c) => (
                      <li key={c.key}>
                        {c.href ? <Link href={c.href}>{c.title}</Link> : c.title}
                        <small>
                          {' '}
                          · {c.type} · {c.status} · Updated: {c.updatedAt ?? 'unknown'}
                        </small>
                      </li>
                    ))}
                  </ul>
                  <div className={styles.actions}>
                    <button
                      className="button secondary"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            JSON.stringify(selected.answer, null, 2),
                          );
                          setFeedback('Answer and citations copied.');
                        } catch {
                          setFeedback('Clipboard unavailable.');
                        }
                      }}
                    >
                      Copy answer
                    </button>
                    <button className="button secondary" onClick={() => void rate('helpful')}>
                      Helpful
                    </button>
                    <button className="button secondary" onClick={() => void rate('unhelpful')}>
                      Not helpful
                    </button>
                  </div>
                  <p role="status">{feedback}</p>
                </article>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
