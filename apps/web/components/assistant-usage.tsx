'use client';
import { useState } from 'react';
export default function AssistantUsage({ organizationId }: { organizationId: string }) {
  const [message, setMessage] = useState('');
  async function refresh() {
    try {
      const response = await fetch(
        '/api/assistant/usage?organization=' + encodeURIComponent(organizationId),
        { cache: 'no-store' },
      );
      const result = await response.json();
      setMessage(
        result.available
          ? `${result.reservations} request reservations on ${result.day} (UTC), including cancelled and failed work. Token costs require provider reconciliation.`
          : 'Usage is unavailable. Administrator access and the AI migration are required.',
      );
    } catch {
      setMessage('Usage is unavailable.');
    }
  }
  return (
    <section className="panel">
      <h2>BidBuddy usage</h2>
      <p>Organization administrator view. No prompts or answers are stored.</p>
      <button className="button secondary" onClick={() => void refresh()}>
        Refresh usage
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
