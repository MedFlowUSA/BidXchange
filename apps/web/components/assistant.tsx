'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FEED_NOTICE,
  type Answer,
  type AssistantContext,
  type RequirementExcerpt,
} from '../lib/ai/contracts';
import { canShareRequirement, requirementExcerptLimit } from '../lib/ai/requirement-sharing';
import styles from './assistant.module.css';
import { requestAssistantAnswer, AssistantResponseError } from '../lib/ai/client-response';
import { evidenceLabel, evidenceValue } from '../lib/ai/display';
import { responseCommand } from '../lib/response-command';
import { createAssistantDocument } from '../app/assistant-document-actions';
import { workspaceHref } from '../lib/routes';
import type { TenantData } from '../lib/tenant-types';
import AssistantTaskPlan from './assistant-task-plan';
import AssistantSavedConversation from './assistant-saved-conversation';
import AssistantSolicitationReview from './assistant-solicitation-review';
import {
  RequirementReviewSelection,
  RequirementReviewResult,
} from './assistant-requirement-review';
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
  const [sharingChoice, setSharingChoice] = useState<RequirementExcerpt>();
  const [sharingConfirmed, setSharingConfirmed] = useState(false);
  const [reviewChoices, setReviewChoices] = useState<RequirementExcerpt[]>([]);
  const canShare =
    !demo &&
    context?.kind === 'pursuit' &&
    planningData &&
    canShareRequirement(planningData.organization.role);
  const [pending, setPending] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [feedback, setFeedback] = useState('');
  const [savedBusy, setSavedBusy] = useState(false);
  const [savedSession, setSavedSession] = useState(0);
  useEffect(() => {
    setSavedBusy(false);
  }, [organizationId, context?.id, available]);
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
              'Which registrations and insurance records need review?',
              'Which company capabilities lack supporting evidence?',
            ];
  useEffect(() => {
    if (demo) return;
    const abort = new AbortController();
    const clear = () => {
      controller.current?.abort();
      setSavedBusy(false);
      setSavedSession((value) => value + 1);
      setConversations([]);
      setActive(null);
      setPrompt('');
      documentRequest.current = null;
      thread.current = null;
      setSharingChoice(undefined);
      setReviewChoices([]);
      setSharingConfirmed(false);
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
      setSavedBusy(false);
      setSavedSession((value) => value + 1);
      setConversations([]);
      setActive(null);
      setPrompt('');
      documentRequest.current = null;
      thread.current = null;
      setSharingChoice(undefined);
      setReviewChoices([]);
      setSharingConfirmed(false);
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
  function changeSharing(choice: RequirementExcerpt | undefined, confirmed = false) {
    controller.current?.abort();
    thread.current = null;
    setConversations([]);
    setActive(null);
    setError('');
    setSharingChoice(choice);
    setReviewChoices([]);
    setSharingConfirmed(confirmed);
  }
  useEffect(() => {
    setSharingChoice(undefined);
    setReviewChoices([]);
    setSharingConfirmed(false);
  }, [organizationId, context?.kind, context?.id]);
  function changeReview(items: RequirementExcerpt[], confirmed = false) {
    changeSharing(undefined, confirmed);
    setReviewChoices(items);
  }
  async function ask(question = prompt, retry = false, answerMode = mode, fresh = false) {
    if (pending || savedBusy || actionLock.current || !question.trim() || !available) return;
    if (!demo && answerMode === 'general' && responseCommand(question)) {
      setError(
        'Switch to Workspace records to create an outline from this bid. General questions do not access company records.',
      );
      return;
    }
    if (
      answerMode === 'workspace' &&
      (sharingChoice || reviewChoices.length > 0) &&
      !sharingConfirmed
    ) {
      setError('Review the selected excerpts and confirm sharing, or clear the selection.');
      return;
    }
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
          nextAction: 'Open the sample bid and review its requirements and evidence.',
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
      const answer = await requestAssistantAnswer(
        {
          organizationId,
          requestId: id,
          prompt: question,
          context: answerMode === 'general' ? null : context,
          mode: answerMode,
          ...(answerMode === 'workspace' && canShare && sharingConfirmed && sharingChoice
            ? {
                sharedRequirement: {
                  id: sharingChoice.id,
                  updatedAt: sharingChoice.updatedAt,
                  consent: true,
                },
              }
            : {}),
          ...(answerMode === 'workspace' && canShare && sharingConfirmed && reviewChoices.length
            ? {
                sharedRequirements: reviewChoices.map(({ id, updatedAt }) => ({
                  id,
                  updatedAt,
                  consent: true,
                })),
              }
            : {}),
          ...(continuation ? { continuation } : {}),
        },
        { signal: abort.signal, onStatus: setStatus },
      );
      if (abort.signal.aborted) return;
      thread.current = answer.continuation
        ? { mode: answerMode, token: answer.continuation }
        : null;
      setPrompt('');
      setConversations((old) => old.map((c) => (c.id === id ? { ...c, answer } : c)));
    } catch (error) {
      if (error instanceof AssistantResponseError && error.code === 'conversation_changed') {
        thread.current = null;
        setConversations([]);
        setActive(null);
        setSharingChoice(undefined);
        setReviewChoices([]);
        setSharingConfirmed(false);
        if (sharingChoice || reviewChoices.length)
          error = new Error(
            'The requirement or conversation changed. Refresh the pursuit and review the current excerpt before sharing again.',
          );
      }
      setError(
        abort.signal.aborted
          ? 'Generation cancelled.'
          : error instanceof Error
            ? error.message
            : 'BidBuddy is unavailable.',
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
    <section id="bid-assistant" className={`panel ${styles.panel}`} aria-label="Ask BidBuddy">
      <div className={styles.heading}>
        <div>
          <div className="eyebrow">BY BIDXCHANGE</div>
          <h2>BidBuddy</h2>
          <p>Ask questions, review requirements, and plan your bid work.</p>
          <p>
            {name} · {demo ? 'Fictional scripted demonstration' : 'Your selected company'}
          </p>
        </div>
        <button className="button secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Collapse BidBuddy' : 'Open BidBuddy'}
        </button>
      </div>
      {open && (
        <>
          <p className="info-note">
            {demo ? FEED_NOTICE + ' ' : ''}AI suggestions need your review. BidBuddy does not
            approve or submit bids.
          </p>
          {!demo && (
            <div className="info-note" aria-label="Company records connection">
              <strong>
                {mode === 'workspace'
                  ? `Company records selected: ${name}`
                  : 'Company records off for general questions'}
              </strong>
              <details>
                <summary>What BidBuddy can access</summary>
                <p>
                  Workspace answers read your latest saved, authorized company records and the
                  selected bid on each question. Save profile changes first, then ask again or
                  refresh an answer. Earlier answers remain snapshots.
                </p>
                <p>
                  General questions do not use company records. This chat has no live web browsing.
                  Do not enter passwords or API keys.
                </p>
              </details>
              <Link href={workspaceHref('/company', organizationId)}>Manage company records</Link>
            </div>
          )}
          {!demo && context?.kind === 'pursuit' && (
            <details>
              <summary>Create a saved response outline</summary>
              <p>
                In Workspace records mode, ask “Create a response outline for this bid” to save a
                response outline with bid details and requirement sections. Complete and review the
                answers before exporting.
              </p>
            </details>
          )}
          {checking ? (
            <p role="status">Checking assistant availability…</p>
          ) : !available ? (
            <p role="status">
              {demo
                ? 'The fictional scripted assistant is disabled. No paid AI is available in the public demo.'
                : 'AI is unavailable for this workspace. Ask your workspace administrator to check access. Your company records and bid tools are still available.'}
            </p>
          ) : null}
          {canShare &&
            available &&
            planningData &&
            context?.kind === 'pursuit' &&
            mode === 'workspace' && (
              <AssistantSolicitationReview
                key={`source:${organizationId}:${context.id}:${savedSession}`}
                data={planningData}
                pursuitId={context.id}
                disabled={pending || savedBusy}
                onBusy={setSavedBusy}
              />
            )}
          <div className={styles.layout}>
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
                          disabled={pending || savedBusy}
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
              <details hidden={conversations.length > 0}>
                <summary>Suggested questions</summary>
                <div className={styles.suggestions}>
                  {!demo && context?.kind === 'pursuit' && (
                    <button
                      className="button secondary"
                      disabled={pending || savedBusy}
                      onClick={() => setPrompt('Create a response outline for this solicitation')}
                    >
                      Create a response outline for this solicitation
                    </button>
                  )}
                  {questions.map((q) => (
                    <button
                      key={q}
                      className="button secondary"
                      disabled={pending || savedBusy}
                      onClick={() => setPrompt(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </details>
              {selected?.document && (
                <article aria-label="BidBuddy document">
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
                <article aria-label="BidBuddy answer">
                  <h3>{demo ? 'Fictional answer' : 'BidBuddy response'}</h3>
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
                        disabled={pending || savedBusy || !available}
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
                  <RequirementReviewResult answer={selected.answer} />
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
                  {selected.answer.sharedRequirement && (
                    <details className={styles.planCard}>
                      <summary>Requirement excerpt used for this answer</summary>
                      <blockquote>{selected.answer.sharedRequirement.text}</blockquote>
                      <p>
                        AI explanation — human review required.{' '}
                        {selected.answer.sharedRequirement.truncated
                          ? 'This is a partial excerpt. Review the complete requirement before relying on the explanation.'
                          : 'Compare the explanation with the original notice.'}
                      </p>
                    </details>
                  )}
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
                              ...(selected.answer!.requirementReview?.length
                                ? [
                                    'AI review of selected excerpts only. Human review required; no requirement status changed.',
                                    ...selected.answer!.requirementReview.map(
                                      (row, index) =>
                                        `Requirement ${index + 1}\nWhat it asks: ${row.meaning}\nCompany-record comparison: ${row.comparison}\nSuggested next step: ${row.nextStep}`,
                                    ),
                                  ]
                                : []),
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
                    {(demo || selected.requestId) && (
                      <>
                        <button className="button secondary" onClick={() => void rate('helpful')}>
                          Helpful
                        </button>
                        <button className="button secondary" onClick={() => void rate('unhelpful')}>
                          Not helpful
                        </button>
                      </>
                    )}
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
                      disabled={pending || savedBusy}
                      onChange={(e) => {
                        thread.current = null;
                        if (sharingChoice || reviewChoices.length) changeSharing(undefined);
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
                  disabled={pending || savedBusy || !available}
                />
                <div className={styles.actions}>
                  <button
                    className="button primary"
                    disabled={
                      pending ||
                      savedBusy ||
                      !available ||
                      !prompt.trim() ||
                      (mode === 'workspace' &&
                        (!!sharingChoice || reviewChoices.length > 0) &&
                        !sharingConfirmed)
                    }
                  >
                    Ask BidBuddy
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
                {canShare && mode === 'workspace' && (
                  <RequirementReviewSelection
                    requirements={
                      planningData?.requirements?.filter((r) => r.pursuit_id === context?.id) ?? []
                    }
                    selected={reviewChoices}
                    confirmed={sharingConfirmed}
                    disabled={pending || savedBusy || !available}
                    onChange={changeReview}
                    onQuestion={() =>
                      setPrompt(
                        'Review each selected requirement against our company records. Explain what it asks, cite relevant records and their freshness, identify missing evidence or clarification, and propose follow-up tasks without duplicating existing work.',
                      )
                    }
                  />
                )}
                {canShare && mode === 'workspace' && (
                  <fieldset
                    className={styles.planCard}
                    disabled={pending || savedBusy || !available}
                  >
                    <legend>Explain a requirement</legend>
                    <p>
                      Choose one requirement to explain in plain English. Only the previewed excerpt
                      is sent to AI with this conversation. Other clause text stays private.
                    </p>
                    <label htmlFor="assistant-requirement">Requirement to explain</label>
                    <select
                      id="assistant-requirement"
                      value={sharingChoice?.id ?? ''}
                      onChange={(event) => {
                        const requirement = planningData?.requirements?.find(
                          (r) => r.id === event.target.value && r.pursuit_id === context?.id,
                        );
                        changeSharing(
                          requirement
                            ? {
                                id: requirement.id,
                                updatedAt: requirement.updated_at,
                                consent: true,
                                text: requirement.requirement.slice(0, requirementExcerptLimit),
                                truncated: requirement.requirement.length > requirementExcerptLimit,
                              }
                            : undefined,
                        );
                      }}
                    >
                      <option value="">No requirement text shared</option>
                      {planningData?.requirements
                        ?.filter((r) => r.pursuit_id === context?.id)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.requirement.slice(0, 100)}
                          </option>
                        ))}
                    </select>
                    {sharingChoice && (
                      <>
                        <blockquote>{sharingChoice.text}</blockquote>
                        {sharingChoice.truncated && (
                          <p>
                            Preview limited to the first {requirementExcerptLimit.toLocaleString()}{' '}
                            characters. The explanation may miss later conditions.
                          </p>
                        )}
                        <label>
                          <input
                            type="checkbox"
                            checked={sharingConfirmed}
                            onChange={(event) => changeSharing(sharingChoice, event.target.checked)}
                          />{' '}
                          I reviewed this excerpt and am authorized to share it with AI for this
                          conversation.
                        </label>
                        <p>
                          Do not share confidential or restricted source material. Changing the
                          selection starts a new conversation; it does not undo text already sent.
                          No requirement status changes.
                        </p>
                        <button
                          type="button"
                          className="button secondary"
                          disabled={!sharingConfirmed}
                          onClick={() =>
                            setPrompt(
                              'Explain this selected requirement in plain English: what does it ask us to do, who is responsible, what is unclear, and what follow-up task should we consider? Cite the requirement.',
                            )
                          }
                        >
                          Use explanation question
                        </button>
                      </>
                    )}
                  </fieldset>
                )}
              </form>
              <p role="status" aria-live="polite">
                {pending ? status : ''}
              </p>
              {error && (
                <div role="alert">
                  <p>{error}</p>
                  <button
                    className="button secondary"
                    disabled={pending || savedBusy || !available}
                    onClick={() =>
                      void ask(selected?.question ?? prompt, true, selected?.mode ?? mode)
                    }
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
            <aside aria-label="Conversations">
              <button
                className="button secondary"
                disabled={pending || savedBusy}
                onClick={() => {
                  setActive(null);
                  setConversations([]);
                  thread.current = null;
                  setPrompt('');
                  documentRequest.current = null;
                  setError('');
                  setFeedback('');
                  setSharingChoice(undefined);
                  setReviewChoices([]);
                  setSharingConfirmed(false);
                }}
              >
                New conversation
              </button>
              <p>
                Up to eight recent exchanges provide follow-up context for 30 minutes. Unsaved
                conversations clear when you leave or reload.{' '}
                {context?.kind === 'pursuit'
                  ? 'Save below to return later; saved copies remain private to your account.'
                  : 'Open a bid in Pursuits to save and resume its conversation.'}
              </p>
              {!demo && available && organizationId && context?.kind === 'pursuit' && (
                <AssistantSavedConversation
                  key={`${organizationId}:${context.id}:${savedSession}`}
                  organizationId={organizationId}
                  pursuitId={context.id}
                  checkpoint={
                    selected?.mode === 'workspace' ? selected.answer?.saveCheckpoint : undefined
                  }
                  disabled={pending || savedBusy}
                  onBusy={setSavedBusy}
                  onResume={(answer, turns) => {
                    thread.current = answer.continuation
                      ? { mode: 'workspace', token: answer.continuation }
                      : null;
                    const restored = turns.map((turn, i) => ({
                      id: crypto.randomUUID(),
                      question: turn.question,
                      mode: 'workspace' as const,
                      answer:
                        i === turns.length - 1
                          ? answer
                          : {
                              answer: [{ text: turn.answer, sources: [] }],
                              risks: [],
                              nextAction: '',
                              citations: [],
                              evidence: [],
                              notice:
                                'Earlier saved AI answer. Ask a new question to review current records.',
                            },
                    }));
                    setConversations(restored);
                    setActive(restored.at(-1)?.id ?? null);
                    setMode('workspace');
                    setSharingChoice(answer.sharedRequirement);
                    setReviewChoices(answer.sharedRequirements ?? []);
                    setSharingConfirmed(
                      !!answer.sharedRequirement || !!answer.sharedRequirements?.length,
                    );
                    setPrompt('');
                    setError('');
                    setFeedback('');
                    documentRequest.current = null;
                  }}
                />
              )}
              {conversations.map((c, i) => (
                <button
                  className={styles.conversation}
                  key={c.id}
                  disabled={pending || savedBusy}
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
                disabled={pending || savedBusy}
                onClick={() => {
                  setConversations([]);
                  thread.current = null;
                  setActive(null);
                  setPrompt('');
                  documentRequest.current = null;
                  setError('');
                  setFeedback('');
                  setSharingChoice(undefined);
                  setReviewChoices([]);
                  setSharingConfirmed(false);
                }}
              >
                Clear conversations
              </button>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
