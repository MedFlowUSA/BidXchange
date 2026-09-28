'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  defaultSamFilters,
  validateSamFilters,
  type SamFilters,
  type SamCompanyCode,
  type SamReport,
} from '../lib/research/sam-contracts';
import { samDemoReport } from '../lib/research/sam-demo';
import styles from './assistant.module.css';

export default function AssistantSamResearch({
  org,
  demo = false,
  initialPrompt = '',
  onClose,
  renderSave,
}: {
  org?: string;
  demo?: boolean;
  initialPrompt?: string;
  onClose: () => void;
  renderSave?: (result: SamReport['results'][number], checkedAt: string) => ReactNode;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [filters, setFilters] = useState<SamFilters>(() => defaultSamFilters());
  const [codes, setCodes] = useState<SamCompanyCode[]>([]);
  const [prepared, setPrepared] = useState(false);
  const [consent, setConsent] = useState(false);
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(!demo);
  const [pending, setPending] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<SamReport | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const endpoint = '/api/assistant/research/sam';
  const section = useRef<HTMLElement | null>(null);
  useEffect(() => {
    section.current?.focus();
    if (demo) return;
    const c = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => c.abort(), 15000);
    fetch(`${endpoint}?organization=${encodeURIComponent(org ?? '')}`, {
      cache: 'no-store',
      signal: c.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.message || 'Research unavailable.');
        if (!c.signal.aborted) {
          setAvailable(body.available === true);
          setCodes(body.company.codes);
        }
      })
      .catch(() => {
        if (!disposed) setMessage('Research access could not be checked. Reopen to try again.');
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!disposed) setChecking(false);
      });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      c.abort();
      controller.current?.abort();
    };
  }, [org, demo]);
  useEffect(() => {
    const hide = () => {
      controller.current?.abort();
      setReport(null);
      setCodes([]);
      setPrompt('');
      setPrepared(false);
      setConsent(false);
      setDraft(null);
      onClose();
    };
    window.addEventListener('pagehide', hide);
    return () => window.removeEventListener('pagehide', hide);
  }, [onClose]);
  function change<K extends keyof SamFilters>(key: K, value: SamFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setConsent(false);
    setReport(null);
    setDraft(null);
  }
  async function run(action: 'prepare' | 'search') {
    if (lock.current) return;
    if (demo) {
      const sample = samDemoReport();
      setFilters(sample.filters);
      setPrepared(true);
      setWarnings(sample.warnings);
      if (action === 'search') setReport(sample);
      return;
    }
    if (action === 'search') {
      try {
        validateSamFilters(filters);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Check the search filters.');
        return;
      }
      if (!consent || !available) return;
    }
    lock.current = true;
    setPending(true);
    setReport(null);
    setDraft(null);
    if (action === 'prepare') {
      setPrepared(false);
      setConsent(false);
    }
    setMessage(
      action === 'prepare'
        ? 'Preparing filters; no SAM.gov request yet…'
        : 'Checking the official SAM.gov API…',
    );
    const c = new AbortController();
    controller.current = c;
    const timeout = setTimeout(() => c.abort(), 50000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: c.signal,
        body: JSON.stringify({
          organizationId: org,
          requestId: crypto.randomUUID(),
          action,
          ...(action === 'prepare' ? { prompt } : { filters, consent: true }),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Research unavailable.');
      if (c.signal.aborted) return;
      setCodes(body.company.codes);
      if (action === 'prepare') {
        setFilters(body.prepared.filters);
        setPrepared(!body.prepared.unsupported);
        setConsent(false);
        setWarnings(body.prepared.warnings);
        setAvailable(body.available);
        setMessage(
          body.prepared.unsupported
            ? 'This tool searches federal contract notices, not grants or saved workspace records. Change the question or use the existing workspace research page.'
            : 'Review the filters below. No SAM.gov request has been made.',
        );
      } else {
        setReport(body.report);
        setMessage('Source results received. Review the official notice before saving.');
      }
    } catch (e) {
      if (!c.signal.aborted) setMessage(e instanceof Error ? e.message : 'Research unavailable.');
      else setMessage('Research cancelled or timed out. No results retained.');
    } finally {
      clearTimeout(timeout);
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <section
      className={`${styles.planCard} ${styles.researchPanel}`}
      aria-label="SAM.gov bid research"
      tabIndex={-1}
      ref={section}
    >
      <div className={styles.actions}>
        <h3>{demo ? 'Try a fictional bid-search example' : 'Find bids on SAM.gov'}</h3>
        <button type="button" onClick={onClose}>
          Back to conversation
        </button>
      </div>
      <p>
        {demo
          ? 'Apex Energy Demo is fictional. This walkthrough makes no web or AI request and cannot search for your company.'
          : 'Prepare a search, review exactly what will be sent, then check official federal notices. Company-code comparisons happen inside BidXchange.'}
      </p>
      {!demo && org && (
        <p>
          For PEPMA and other state, utility or local sources, use{' '}
          <Link href={`/opportunities/registry?organization=${org}`}>
            official portal shortcuts and connection status
          </Link>
          . This search checks SAM.gov only.
        </p>
      )}
      {!demo && !checking && !available && (
        <p className="info-note">
          Live SAM.gov search is not configured or available here yet. You can prepare filters; an
          administrator must enable the official connection.{' '}
          <a href="https://sam.gov/opportunities" target="_blank" rel="noopener noreferrer">
            Open SAM.gov externally
          </a>
          .
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run('prepare');
        }}
      >
        <label>
          What bids should BidBuddy look for?
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setPrepared(false);
              setReport(null);
              setConsent(false);
              setDraft(null);
            }}
            maxLength={3000}
            rows={3}
            required={!demo}
            disabled={pending}
            placeholder="Find electrical retrofit notices in California published in the last 30 days."
          />
        </label>
        <button className="button primary" disabled={pending || checking} type="submit">
          {demo ? 'Prepare sample search' : 'Prepare search filters'}
        </button>
      </form>
      {prepared && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run('search');
          }}
        >
          <h4>Review public search filters</h4>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <div className={styles.researchFields}>
            <label>
              Title keyword or phrase
              <input
                value={filters.title}
                maxLength={120}
                disabled={pending || demo}
                onChange={(e) => change('title', e.target.value)}
              />
            </label>
            <label>
              NAICS code (optional)
              <input
                value={filters.naics}
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}|"
                disabled={pending || demo}
                onChange={(e) => change('naics', e.target.value)}
              />
            </label>
            <label>
              State abbreviation (optional)
              <input
                value={filters.state}
                maxLength={2}
                disabled={pending || demo}
                onChange={(e) => change('state', e.target.value.toUpperCase())}
              />
            </label>
            <label>
              Notice type
              <select
                value={filters.noticeType}
                disabled={pending || demo}
                onChange={(e) => change('noticeType', e.target.value as SamFilters['noticeType'])}
              >
                <option value="">All returned notice types</option>
                <option value="o">Solicitation</option>
                <option value="k">Combined synopsis / solicitation</option>
                <option value="r">Sources sought</option>
                <option value="p">Pre-solicitation</option>
              </select>
            </label>
            <label>
              Published from
              <input
                type="date"
                value={filters.postedFrom}
                disabled={pending || demo}
                onChange={(e) => change('postedFrom', e.target.value)}
              />
            </label>
            <label>
              Published through
              <input
                type="date"
                value={filters.postedTo}
                disabled={pending || demo}
                onChange={(e) => change('postedTo', e.target.value)}
              />
            </label>
          </div>
          {!demo && (
            <>
              <p>Optional codes from current, human-attested company records:</p>
              {codes.length ? (
                <div className={styles.actions}>
                  {codes.map((c) => (
                    <button
                      type="button"
                      key={c.code}
                      disabled={pending}
                      onClick={() => change('naics', c.code)}
                    >
                      Use company NAICS {c.code}
                    </button>
                  ))}
                </div>
              ) : (
                <p>
                  No current company NAICS record is visible to your role. Enter a code or a title
                  keyword yourself.
                </p>
              )}
              <label className={styles.researchConsent}>
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={pending}
                  onChange={(e) => setConsent(e.target.checked)}
                />{' '}
                I reviewed these filters and agree to send them to SAM.gov. I have not included
                confidential information.
              </label>
            </>
          )}
          <button
            type="submit"
            className="button primary"
            disabled={pending || (!demo && (!consent || !available))}
          >
            {demo ? 'Show fictional results' : 'Search SAM.gov now'}
          </button>
        </form>
      )}
      {pending && (
        <button type="button" onClick={() => controller.current?.abort()}>
          Cancel research
        </button>
      )}
      <p role="status">{message}</p>
      {report && (
        <div aria-label="SAM.gov research results">
          <p>
            <strong>{demo ? 'Fictional results' : 'Official SAM.gov API results'}</strong> ·
            Checked: {report.checkedAt}
          </p>
          <p>
            Showing {report.returned} of {report.total} records reported by this query.{' '}
            {report.partial
              ? 'Partial results: only the first page was retrieved. Narrow the filters or check SAM.gov for more.'
              : 'This describes the returned query, not every opportunity in the market.'}
          </p>
          <ul>
            {report.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {!report.results.length && (
            <p>
              No notices were returned for these filters. Try another title phrase, code or
              publication window; this does not establish that no bids exist.
            </p>
          )}
          {report.results.map((r) => (
            <article className={styles.planCard} key={r.id}>
              <h4>{r.title}</h4>
              <p>
                {r.agency ?? 'Agency not provided'} · {r.noticeType ?? 'Notice type unknown'} ·
                Status: {r.status}
              </p>
              <p>
                Published: {r.published ?? 'Not provided'}
                <br />
                Response deadline: {r.deadline ?? 'Not provided'}
                {r.deadline && !r.deadlineInstant
                  ? ' · Time zone/instant unconfirmed; verify with buyer.'
                  : ''}
                <br />
                NAICS: {r.naics ?? 'Not provided'} · State: {r.state ?? 'Not provided'}
              </p>
              {r.companyEvidence.length ? (
                <p>
                  Company code overlap only:{' '}
                  {r.companyEvidence.map((c) => (
                    <span key={c.factId}>
                      {demo ? (
                        c.label
                      ) : (
                        <Link href={`/company?organization=${org}#fact-${c.factId}`}>
                          {c.code} · {c.label}
                        </Link>
                      )}{' '}
                    </span>
                  ))}
                  . This does not establish eligibility.
                </p>
              ) : (
                <p>
                  No overlap with current company NAICS records was found in the bounded comparison.
                  Review the scope and company profile.
                </p>
              )}
              <p>
                Next: review license classification, DIR, insurance, bonding, mandatory meetings and
                the full solicitation before a bid decision.
              </p>
              {r.url && (
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  Open official SAM.gov notice (external)
                </a>
              )}
              {!r.url && !demo && (
                <p>
                  Official notice URL was not supplied. Confirm the notice on SAM.gov using
                  solicitation {r.solicitationNumber ?? r.id}.
                </p>
              )}
              {demo ? (
                <Link href="/pursuits/DEMO-001?workspace=demo">
                  Continue the fictional bid review
                </Link>
              ) : report.canSave && org && renderSave ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setDraft(draft === r.id ? null : r.id)}
                  >
                    Review before saving opportunity
                  </button>
                  {draft === r.id && renderSave(r, report.checkedAt)}
                </>
              ) : (
                <p>
                  A bid lead or organization administrator can save this notice as an opportunity.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
