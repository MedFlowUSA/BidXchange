'use client';
import { useEffect, useRef, useState } from 'react';
import type { Answer } from '../lib/ai/contracts';
import type { ChatTurn } from '../lib/ai/conversation';

export default function AssistantSavedConversation({
  organizationId,
  pursuitId,
  checkpoint,
  disabled,
  onResume,
  onBusy,
}: {
  organizationId: string;
  pursuitId: string;
  checkpoint?: string;
  disabled: boolean;
  onResume: (answer: Answer, turns: ChatTurn[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [saved, setSaved] = useState<{ saved_at: string; expires_at: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const endpoint = `/api/assistant/conversations?organizationId=${organizationId}&pursuitId=${pursuitId}`;
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    const abort = new AbortController();
    void fetch(endpoint, { cache: 'no-store', signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw Error('Saved conversations could not be loaded.');
        const result = await r.json();
        if (!abort.signal.aborted) setSaved(result.saved);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setMessage(
            'Saved conversations are unavailable right now. You can still ask a new question.',
          );
      });
    return () => abort.abort();
  }, [endpoint]);
  async function act(action: 'save' | 'resume' | 'delete') {
    if (busy || disabled) return;
    setBusy(true);
    onBusy(true);
    setMessage('');
    const abort = new AbortController();
    operation.current = abort;
    try {
      const response = await fetch('/api/assistant/conversations', {
        method: 'POST',
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          pursuitId,
          action,
          ...(action === 'save' ? { checkpoint } : {}),
        }),
      });
      const result = await response.json();
      if (abort.signal.aborted) return;
      if (!response.ok)
        throw Error(
          result.code === 'conversation_changed'
            ? 'This saved conversation expired, its sources changed, or your access changed. Start a new conversation using current records.'
            : (result.message ?? 'Saved conversation unavailable.'),
        );
      if (action === 'resume') {
        onResume(result.answer, result.turns);
        setMessage(
          'Conversation resumed. Source access and freshness were checked. Ask a follow-up to get a new answer.',
        );
      }
      if (action === 'delete') {
        setSaved(null);
        setMessage('Saved copy deleted. This open conversation is unchanged.');
      }
      if (action === 'save') {
        const refreshed = await fetch(endpoint, { cache: 'no-store', signal: abort.signal });
        if (!refreshed.ok) throw Error('Saved, but the saved date could not be refreshed.');
        setSaved((await refreshed.json()).saved);
        setMessage(
          'Saved privately for this bid. Save again after your next exchange to update it.',
        );
      }
    } catch (e) {
      if (!abort.signal.aborted)
        setMessage(e instanceof Error ? e.message : 'Saved conversation unavailable.');
    } finally {
      if (!abort.signal.aborted) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  return (
    <section aria-label="Saved bid conversation">
      <h3>Return to this bid later</h3>
      <p>
        Save up to eight recent exchanges for this bid. Private to you; replaces your last save and
        expires after 30 days. Nothing is saved automatically.
      </p>
      <button
        className="button secondary"
        disabled={disabled || busy || !checkpoint}
        onClick={() => void act('save')}
      >
        {saved ? 'Update saved conversation' : 'Save conversation'}
      </button>
      {saved && (
        <>
          <p>
            Saved {new Date(saved.saved_at).toLocaleString()}. Expires{' '}
            {new Date(saved.expires_at).toLocaleDateString()}.
          </p>
          <button
            className="button secondary"
            disabled={disabled || busy}
            onClick={() => void act('resume')}
          >
            Resume saved conversation
          </button>
          <button
            className="text-button"
            disabled={disabled || busy}
            onClick={() => void act('delete')}
          >
            Delete saved conversation
          </button>
        </>
      )}
      <p role="status">{busy ? 'Checking saved conversation…' : message}</p>
    </section>
  );
}
