'use client';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { nextActions, workspaceGuide } from '../lib/workspace-guide';
import type { TenantData } from '../lib/tenant-types';
import { pursuitAttention } from '../lib/pursuit-attention';
import styles from './pursuit-attention.module.css';
const subscribe = (listener: () => void) => {
  window.addEventListener('bidx-guide', listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener('bidx-guide', listener);
    window.removeEventListener('storage', listener);
  };
};
export function GuideContent({ data, pursuitId }: { data: TenantData; pursuitId?: string }) {
  return (
    <div className="workspace-guide">
      <p>
        Follow your organization’s records from source to submission. These steps reflect visible
        saved records; opening a page never completes a step. “Recorded” confirms a record exists,
        not that the company qualifies.
      </p>
      <ol>
        {workspaceGuide(data, pursuitId).map((step) => (
          <li key={step.id}>
            <Link href={step.href}>{step.title}</Link>
            <span className="guide-state">
              {step.state === 'recorded'
                ? 'Recorded'
                : step.state === 'review'
                  ? 'Review needed'
                  : step.state === 'unavailable'
                    ? 'Not evaluated / unavailable'
                    : 'Action needed'}
            </span>
            <p>{step.detail}</p>
            {step.locked && <small>{step.locked}</small>}
          </li>
        ))}
      </ol>
      <p>
        <a href="/guides/bidxchange-user-guide.html" target="_blank" rel="noopener noreferrer">
          Read the accessible how-to guide
        </a>{' '}
        ·{' '}
        <a href="/guides/bidxchange-user-guide.pdf" target="_blank" rel="noopener noreferrer">
          Download the PDF guide
        </a>
      </p>
    </div>
  );
}
export function GettingStarted({ data, onOpen }: { data: TenantData; onOpen: () => void }) {
  const key = `bidx-guide-dismissed:${data.organization.id}:${data.userId}`;
  const dismissed = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) === 'yes';
      } catch {
        return false;
      }
    },
    () => false,
  );
  if (dismissed) return null;
  return (
    <section className="panel getting-started">
      <div>
        <h2>One pursuit, from source to submission</h2>
        <p>Use the workspace checklist. Your current records determine the next step.</p>
      </div>
      <button className="button" onClick={onOpen}>
        Open getting started
      </button>
      <button
        className="text-button"
        onClick={() => {
          try {
            localStorage.setItem(key, 'yes');
            window.dispatchEvent(new Event('bidx-guide'));
          } catch {
            /* Preference storage is optional. */
          }
        }}
      >
        Dismiss
      </button>
      <small>Reopen anytime from Workspace guide.</small>
    </section>
  );
}
export function NextActions({
  data,
  page,
  pursuitId,
  opportunityId,
}: {
  data: TenantData;
  page: string;
  pursuitId?: string;
  opportunityId?: string;
}) {
  const actions = nextActions(data, page, pursuitId, opportunityId),
    primary = actions[0];
  const attention = pursuitId ? pursuitAttention(data, pursuitId, primary) : null;
  return (
    <section
      className={`panel next-actions ${attention ? styles.brief : ''}`}
      aria-label="Suggested next actions"
    >
      {attention && (
        <dl className={styles.metrics}>
          <div>
            <dt>Recorded submission deadline</dt>
            <dd>{attention.deadline}</dd>
          </div>
          <div>
            <dt>Human-confirmed blockers</dt>
            <dd>{attention.blockers}</dd>
          </div>
          <div>
            <dt>Open tasks</dt>
            <dd>
              {attention.openTasks}
              <span> · {attention.overdue} overdue</span>
            </dd>
          </div>
          <div>
            <dt>Decision</dt>
            <dd>{attention.decisionLabel}</dd>
          </div>
        </dl>
      )}
      <div className="eyebrow">NEXT ACTION</div>
      <h2>
        <Link href={primary.href}>{primary.title}</Link>
      </h2>
      <p>{primary.reason}</p>
      {attention && (
        <div className={styles.owner}>
          <p>
            <strong>Responsible:</strong> {attention.owner}
          </p>
          {attention.taskDue && (
            <p>
              <strong>Task due:</strong> {attention.taskDue}
            </p>
          )}
          {attention.handoff && <p>{attention.handoff}</p>}
          <Link className="button primary" href={primary.href}>
            Open next action →
          </Link>
          <p className={styles.note}>
            Based on visible saved records at page load. Refresh for updates. Counts do not certify
            eligibility or a complete register.
          </p>
        </div>
      )}
      {actions.length > 1 && (
        <details>
          <summary>Other actions ({actions.length - 1})</summary>
          <ul>
            {actions.slice(1).map((a) => (
              <li key={a.href}>
                <Link href={a.href}>{a.title}</Link>
                <p>{a.reason}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
