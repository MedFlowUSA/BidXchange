'use client';
import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import type { TenantData } from '../lib/tenant-types';
import { readResponseDraft } from '../lib/response-package';
import { canIncludeRestricted } from '../lib/bid-report';
import BidAlignment from './bid-alignment';
export default function BidReportDownload({
  data,
  pursuitId,
  automaticAnswers = false,
}: {
  data: TenantData;
  pursuitId: string;
  automaticAnswers?: boolean;
}) {
  const packages = (data.responsePackages ?? [])
    .filter((p) => p.status === 'draft' && readResponseDraft(p.content))
    .slice(0, 20);
  const [selected, setSelected] = useState(packages[0]?.id ?? '');
  const [restricted, setRestricted] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  async function download() {
    if (controller.current) return;
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setMessage('Preparing your saved bid report…');
    const timer = setTimeout(() => c.abort(), 60000);
    try {
      const saved = automaticAnswers ? undefined : packages.find((p) => p.id === selected);
      if (!automaticAnswers && selected && !saved)
        throw Error('The selected draft is unavailable. Reload before exporting.');
      const query = new URLSearchParams({
        organization: data.organization.id,
        pursuit: pursuitId,
        restricted: String(restricted),
        ...(automaticAnswers ? { answers: 'latest' } : {}),
        ...(saved ? { package: saved.id, version: saved.updated_at } : {}),
      });
      const response = await fetch(`/api/bid-reports?${query}`, {
        cache: 'no-store',
        signal: c.signal,
      });
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: 'The report could not be generated.' }));
        throw Error(body.message || 'The report could not be generated.');
      }
      if (!response.headers.get('Content-Type')?.includes('application/pdf'))
        throw Error('The server did not return a PDF. Please sign in and retry.');
      const blob = await response.blob();
      if (c.signal.aborted) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `bidxchange-bid-report-${pursuitId.slice(0, 8)}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Bid report downloaded. Review its status labels before sharing.');
    } catch (error) {
      if (controller.current === c)
        setMessage(
          c.signal.aborted
            ? 'Report download stopped or timed out. Try again.'
            : error instanceof Error
              ? error.message
              : 'The report could not be generated.',
        );
    } finally {
      clearTimeout(timer);
      if (controller.current === c) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section className="panel" aria-labelledby="bid-report-heading">
      <h2 id="bid-report-heading">Bid report</h2>
      <p>
        Download company details, bid information, reviewed criteria, saved answers, evidence
        references and remaining work in one PDF.
      </p>
      {data.requirements !== undefined && (
        <BidAlignment data={data} pursuitId={pursuitId} restricted={restricted} />
      )}
      {automaticAnswers ? (
        <p>
          Automatically includes the newest supported saved answer draft for this pursuit. If no
          answers are saved, the report shows the requirements and remaining work. Company and bid
          records are fetched again each time you generate the PDF.
        </p>
      ) : (
        <>
          <label htmlFor="bid-report-draft">Answers to include</label>
          <select
            id="bid-report-draft"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={busy}
            style={{
              display: 'block',
              maxWidth: '100%',
              width: '100%',
              marginBlock: 8,
              minHeight: 44,
            }}
          >
            <option value="">No answer draft — show requirements and review findings</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — saved {p.updated_at}
              </option>
            ))}
          </select>
          {!packages.length && (
            <p>
              No saved answers yet. Create and save a response draft below to include them. You can
              still download the current bid review.
            </p>
          )}
          {(data.responsePackages?.length ?? 0) > 20 && (
            <p>The 20 most recently updated supported drafts are offered here.</p>
          )}
        </>
      )}
      {canIncludeRestricted(data.organization.role) && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBlock: 12 }}>
          <input
            type="checkbox"
            checked={restricted}
            disabled={busy}
            onChange={(e) => setRestricted(e.target.checked)}
          />
          Include restricted company records permitted by my role, such as insurance and bonding.
          Keep this copy confidential.
        </label>
      )}
      <p>
        Internal review report, not a buyer submission. Unreviewed records and unanswered items
        remain labeled. Only saved answers are included; save response edits first. Downloading does
        not approve or complete a bid.
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={() => void download()}
      >
        <Download size={16} aria-hidden="true" />{' '}
        {busy
          ? 'Preparing PDF…'
          : automaticAnswers
            ? 'Generate bid report PDF'
            : 'Download bid report PDF'}
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
