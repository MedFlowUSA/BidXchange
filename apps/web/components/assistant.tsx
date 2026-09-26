'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FEED_NOTICE, type Answer, type AssistantContext } from '../lib/ai/contracts';
import styles from './assistant.module.css';
import { evidenceLabel, evidenceValue } from '../lib/ai/display';
import { responseCommand } from '../lib/response-command';
import { createAssistantDocument } from '../app/assistant-document-actions';
import { workspaceHref } from '../lib/routes';
import type { TenantData } from '../lib/tenant-types';
import AssistantTaskPlan from './assistant-task-plan';
type Conversation = {
  id: string;
  question: string;
  answer?: Answer;
  requestId?: string;
  mode: 'general' | 'workspace';
  document?: { message: string; href?: string };
  parentContinuation?: string;
};
export default function Assistant({
  organizationId,
  name,
  context = null,
  demo = false,
  demoEnabled = false,
  expanded = false,
  hasOpportunities = false,
  planningData,
}: {
  organizationId?: string;
  name: string;
  context?: AssistantContext | null;
  demo?: boolean;
  demoEnabled?: boolean;
  expanded?: boolean;
  hasOpportunities?: boolean;
  planningData?: TenantData;
}) {
  const [open, setOpen] = useState(expanded),
    [available, setAvailable] = useState(demo && demoEnabled),
    [checking, setChecking] = useState(!demo);
  const [prompt, setPrompt] = useState(''),
    [conversations, setConversations] = useState<Conversation[]>([]),
    [active, setActive] = useState<string | null>(null);
  const [mode, setMode] = useState<'general' | 'workspace'>('workspace');
  const [pending, setPending] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [feedback, setFeedback] = useState('');
  const controller = useRef<AbortController | null>(null);
  const thread = useRef<{ mode: string; token: string } | null>(null);
  const access = useRef<string | null>(null);
  const actionLock = useRef(false);
  const documentRequest = useRef<{ question: string; id: string } | null>(null);
  const selected = conversations.find((c) => c.id === active);
  useEffect(() => {
    const reveal = () => {
      if (location.hash === '#bid-assistant') setOpen(true);
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, []);
  const questions =
    !demo && mode === 'general'
      ? [
          'Explain how a bid bond works.',
          'Help me write a professional follow-up email.',
          'Brainstorm ways to improve our estimating process.',
        ]
      : context?.kind === 'pursuit'
        ? [
            'Help me plan this bid. Explain what needs review and propose follow-up tasks.',
            'What tasks are overdue?',
            'Which response approvals are current, and what submissions have users recorded for this pursuit?',
          ]
        : context
          ? ['Why should we review this opportunity?', 'What could disqualify us?']
          : [
              `What work does ${name} perform, and which details still need human review?`,
              `What company information needs human review for ${name}?`,
              hasOpportunities
                ? 'Which saved opportunities are due in the next 14 days?'
                : 'Which registrations and insurance records need review?',
              hasOpportunities
                ? 'What saved opportunities were added today?'
                : 'Which company capabilities lack supporting evidence?',
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
      thread.current = null;
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
      thread.current = null;
    };
    window.addEventListener('pagehide', clear);
    return () => window.removeEventListener('pagehide', clear);
  }, []);
  useEffect(() => {
    controller.current?.abort();
    thread.current = null;
    setConversations([]);
    setActive(null);
    setPrompt('');
  }, [organizationId, context?.kind, context?.id]);
  async function ask(question = prompt, retry = false, answerMode = mode, fresh = false) {
    if (pending || actionLock.current || !question.trim() || !available) return;
    actionLock.current = true;
    setError('');
    setFeedback('');
    setPending(true);
    setStatus('Starting…');
    const id = crypto.randomUUID();
    const continuation = fresh
      ? undefined
      : retry
        ? selected?.parentContinuation
        : thread.current?.mode === answerMode
          ? thread.current.token
          : undefined;
    setActive(id);
    setConversations((old) => [
      ...old.slice(-9),
      { id, question, requestId: id, mode: answerMode, parentContinuation: continuation },
    ]);
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
                        'Open the bid in Pursuits, then ask “Create a response outline for this solicitation”. The selected pursuit supplies the bid details and requirements.',
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
          context: answerMode === 'general' ? null : context,
          mode: answerMode,
          ...(continuation ? { continuation } : {}),
        }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const failure = await response.json();
        if (failure.code === 'conversation_changed') {
          thread.current = null;
          setConversations([]);
          setActive(null);
        }
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
          if (abort.signal.aborted) break;
          if (event.type === 'status') setStatus(event.text);
          if (event.type === 'error') {
            if (event.code === 'conversation_changed') {
              thread.current = null;
              setConversations([]);
              setActive(null);
            }
            throw new Error(event.message);
          }
          if (event.type === 'answer') {
            thread.current = event.answer.continuation
              ? { mode: answerMode, token: event.answer.continuation }
              : null;
            setPrompt('');
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
    <section id="bid-assistant" className={`panel ${styles.panel}`} aria-label="Ask BidXchange">
      <div className={styles.heading}>
        <div>
          <div className="eyebrow">ASK BIDXCHANGE</div>
          <h2>Think it through. Build your next step.</h2>
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
            {demo ? FEED_NOTICE : 'Explore options, draft messages and plan your bid work.'} AI
            suggestions need your review. Nothing is approved or submitted for you.
          </p>
          {!demo && (
            <p>
              Use Workspace records for company context, or General questions for broader advice.
              This chat has no live web browsing. Do not enter passwords or API keys.
            </p>
          )}
          {!demo && (
            <div className="info-note" aria-label="Company records connection">
              <strong>
                {mode === 'workspace'
                  ? `Company records selected: ${name}`
                  : 'Company records off for general questions'}
              </strong>
              <p>
                Workspace answers read your latest saved, authorized company records on each
                question. Save changes in Company first, then ask again or refresh an answer.
                Earlier answers remain snapshots.
              </p>
              <Link href={workspaceHref('/company', organizationId)}>Manage company records</Link>
            </div>
          )}
          {!demo && context?.kind === 'pursuit' && (
            <details>
              <summary>Create a saved response outline</summary>
              <p>
                Document commands use the open pursuit in either mode. Ask “Create a response
                outline for this bid” to save a response outline with bid details and requirement
                sections. Complete and review the answers before exporting.
              </p>
            </details>
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
                  setConversations([]);
                  thread.current = null;
                  setPrompt('');
                  documentRequest.current = null;
                  setError('');
                  setFeedback('');
                }}
              >
                New conversation
              </button>
              <p>
                Private to this tab. Recent messages provide follow-up context for up to 30 minutes.
                Reloading, changing company or starting a new conversation clears that context.
              </p>
              {conversations.map((c, i) => (
                <button
                  className={styles.conversation}
                  key={c.id}
                  disabled={pending}
                  aria-pressed={c.id === active}
                  onClick={() => {
                    setActive(c.id);
                    setMode(c.mode);
                    thread.current = c.answer?.continuation
                      ? { mode: c.mode, token: c.answer.continuation }
                      : null;
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
                  thread.current = null;
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
              {conversations.some((c) => c.id !== active && c.answer) && (
                <section className={styles.transcript} aria-label="Conversation history">
                  {conversations
                    .filter((c) => c.id !== active && c.answer)
                    .map((c) => (
                      <div key={c.id} className={styles.exchange}>
                        <p>
                          <strong>You</strong>
                        </p>
                        <p>{c.question}</p>
                        <p>
                          <strong>BidXchange · earlier answer</strong>
                        </p>
                        {c.answer!.answer.map((item, i) => (
                          <p key={i} style={{ whiteSpace: 'pre-wrap' }}>
                            {item.text}
                          </p>
                        ))}
                        <button
                          type="button"
                          className="text-button"
                          disabled={pending}
                          onClick={() => {
                            setActive(c.id);
                            setMode(c.mode);
                            thread.current = c.answer?.continuation
                              ? { mode: c.mode, token: c.answer.continuation }
                              : null;
                          }}
                        >
                          Review sources or continue from this answer
                        </button>
                      </div>
                    ))}
                </section>
              )}
              <div className={styles.suggestions} hidden={conversations.length > 0}>
                {!demo && context?.kind === 'pursuit' && (
                  <button
                    className="button secondary"
                    disabled={pending}
                    onClick={() => setPrompt('Create a response outline for this solicitation')}
                  >
                    Create a response outline for this solicitation
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
                  {!demo && selected.mode === 'workspace' && (
                    <div>
                      <p>
                        {selected.answer.recordsCheckedAt
                          ? `Records checked: ${new Date(selected.answer.recordsCheckedAt).toLocaleString()}`
                          : 'Saved-record snapshot'}
                        . Later edits do not change this answer.
                      </p>
                      <button
                        className="button secondary"
                        disabled={pending || !available}
                        onClick={() => void ask(selected.question, false, 'workspace', true)}
                      >
                        Refresh from company records
                      </button>
                    </div>
                  )}
                  <p>{selected.question}</p>
                  {selected.answer.answer.map((item, index) => (
                    <div key={index}>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{item.text}</p>
                      {!demo && selected.mode === 'workspace' && (
                        <small>
                          {item.sources.length
                            ? 'Based on cited workspace records; AI interpretation requires review.'
                            : 'General guidance, assumptions or draft text—not a company record.'}
                        </small>
                      )}
                    </div>
                  ))}
                  {!demo && !selected.answer.continuation && (
                    <p>
                      Follow-up context is unavailable for this answer. Include the relevant details
                      in your next question.
                    </p>
                  )}
                  {selected.answer.evidence.map((item) => (
                    <details key={item.citation.key}>
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
                  {!demo &&
                    mode === 'workspace' &&
                    selected.mode === 'workspace' &&
                    context?.kind === 'pursuit' &&
                    planningData && (
                      <AssistantTaskPlan
                        key={selected.id}
                        answer={selected.answer}
                        data={planningData}
                        pursuitId={context.id}
                      />
                    )}
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
                            [
                              ...selected.answer!.answer.map((a) => a.text),
                              ...selected.answer!.risks,
                              selected.answer!.nextAction,
                              ...selected.answer!.citations.map(
                                (c) => `${c.title}: ${c.href ?? c.key}`,
                              ),
                            ]
                              .filter(Boolean)
                              .join('\n\n'),
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
                      onChange={(e) => {
                        thread.current = null;
                        setMode(e.target.value as 'general' | 'workspace');
                      }}
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
                    onClick={() =>
                      void ask(selected?.question ?? prompt, true, selected?.mode ?? mode)
                    }
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
