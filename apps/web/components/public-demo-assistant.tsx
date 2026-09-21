'use client';
import { useEffect, useRef, useState } from 'react';
export default function PublicDemoAssistant() {
  const [available, setAvailable] = useState(false),
    [checking, setChecking] = useState(true),
    [prompt, setPrompt] = useState(''),
    [pending, setPending] = useState(false),
    [answer, setAnswer] = useState(''),
    [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/demo-assistant', { cache: 'no-store', signal: c.signal })
      .then((r) => r.json())
      .then((r) => setAvailable(r.available === true))
      .catch(() => setAvailable(false))
      .finally(() => setChecking(false));
    return () => {
      c.abort();
      controller.current?.abort();
    };
  }, []);
  async function ask() {
    if (!available || pending || !prompt.trim()) return;
    setPending(true);
    setError('');
    setAnswer('');
    const c = new AbortController();
    controller.current = c;
    try {
      const r = await fetch('/api/demo-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: crypto.randomUUID(), prompt }),
        signal: c.signal,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setAnswer(data.answer);
    } catch (e) {
      setError(
        c.signal.aborted
          ? 'Generation cancelled.'
          : e instanceof Error
            ? e.message
            : 'The assistant is unavailable.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel" aria-label="Live demo AI">
      <h2>Ask BidXchange</h2>
      <p>
        Live AI for general questions, explanations and drafting. Demo company records are
        fictional; this assistant cannot access workspace data or live websites.
      </p>
      <p>
        Up to 5 questions per browser each day, one per minute. A shared demo allowance also
        applies. Each question is independent. Don’t include confidential information.
      </p>
      {checking ? (
        <p role="status">Checking live demo availability…</p>
      ) : !available ? (
        <p role="status">Live demo AI is temporarily unavailable. Please try again later.</p>
      ) : null}
      <div className="hero-actions">
        {[
          'Explain how a bid bond works.',
          'Draft a follow-up asking for a site-visit clarification.',
          'What should a bid/no-bid review cover?',
        ].map((q) => (
          <button
            key={q}
            type="button"
            className="button"
            disabled={pending}
            onClick={() => setPrompt(q)}
          >
            {q}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <label>
          Ask a question
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={1500}
            rows={4}
            required
            disabled={pending}
            style={{ width: '100%', marginBlock: 12 }}
          />
        </label>
        <button className="button primary" disabled={!available || pending || !prompt.trim()}>
          {pending ? 'Thinking…' : 'Ask BidXchange'}
        </button>
        {pending && (
          <button className="button" type="button" onClick={() => controller.current?.abort()}>
            Cancel
          </button>
        )}
      </form>
      <p role="status" aria-live="polite">
        {pending ? 'Generating an answer…' : error}
      </p>
      {answer && (
        <article
          aria-label="AI answer"
          style={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            lineHeight: 1.7,
            marginTop: 20,
          }}
        >
          <h3>Live AI response</h3>
          <p>{answer}</p>
          <small>No company records or live sources were accessed.</small>
          <div>
            <button
              className="button"
              onClick={() => {
                setAnswer('');
                setPrompt('');
                setError('');
              }}
            >
              Clear answer
            </button>
          </div>
        </article>
      )}
    </section>
  );
}
