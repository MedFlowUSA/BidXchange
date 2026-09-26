'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { bidControl } from '../lib/bid-control';
import styles from './qualification-workspace.module.css';
import PursuitCalendar from './pursuit-calendar';

export default function BidControl({ data, pursuitId }: { data: TenantData; pursuitId: string }) {
  const control = bidControl(data, pursuitId);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const filters = [
    { value: 'all', label: 'All open tasks', match: () => true },
    {
      value: 'overdue',
      label: 'Overdue',
      match: (item: (typeof control.taskDates)[number]) => item.overdue,
    },
    {
      value: 'dates',
      label: 'Dates to confirm',
      match: (item: (typeof control.taskDates)[number]) => item.needsDateReview,
    },
    {
      value: 'owners',
      label: 'Owners to confirm',
      match: (item: (typeof control.taskDates)[number]) => item.needsOwner,
    },
    {
      value: 'submission',
      label: 'At or after submission',
      match: (item: (typeof control.taskDates)[number]) => item.atOrAfterSubmission,
    },
  ];
  const visible = control.taskDates.filter(filters.find((item) => item.value === filter)!.match);
  const base = `/pursuits/${pursuitId}?organization=${data.organization.id}`;
  return (
    <section className="panel" aria-labelledby="bid-control-heading">
      <h2 id="bid-control-heading">Bid control: decision, work and dates</h2>
      <div className={styles.metrics}>
        <div>
          <strong>{control.open.length}</strong>
          <span>Open tasks</span>
        </div>
        <div>
          <strong>{control.overdue}</strong>
          <span>Overdue tasks</span>
        </div>
        <div>
          <strong>{control.unassigned}</strong>
          <span>Tasks needing an active owner</span>
        </div>
      </div>
      <p>
        <Link href={`${base}#bid-decision`}>Decision memo</Link>:{' '}
        {control.decision.replaceAll('_', ' ')} · {control.decisionState}
      </p>
      <p>
        <Link href={`${base}#register-signoff`}>Requirements Register</Link>: {control.signoff}
      </p>
      {control.partial && <p>A task limit was reached. Counts and dates may be incomplete.</p>}
      <div className={styles.row} aria-label="Submission deadline">
        <h3>Recorded submission deadline</h3>
        <p>{control.submission?.label ?? 'No opportunity deadline is visible.'}</p>
        {control.submission?.overdue && (
          <p>
            The recorded deadline has passed. Confirm an official extension before planning
            submission.
          </p>
        )}
        {control.submission?.needsDateReview && (
          <p>
            Confirm the deadline and time zone from the official notice. Task timing cannot be
            compared until both are recorded correctly.
          </p>
        )}
        <Link href={base}>Review opportunity and submission details</Link>
      </div>
      <PursuitCalendar data={data} pursuitId={pursuitId} />
      <h3>Recorded dates and follow-ups</h3>
      <p>
        Submission deadline and open task dates only. Record job walks, questions deadlines and bond
        requests as tasks after checking the notice. Use Dates to confirm to find undated work; this
        is not a complete solicitation calendar.
      </p>
      {!control.dates.length && (
        <p>
          No dates or tasks are visible. Open the pursuit to record its source and next actions.
        </p>
      )}
      <label htmlFor="bid-date-filter">Focus on work needing attention</label>
      <select
        id="bid-date-filter"
        className={styles.select}
        value={filter}
        onChange={(event) => {
          setFilter(event.target.value);
          setExpanded(false);
        }}
      >
        {filters.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label} ({control.taskDates.filter(item.match).length})
          </option>
        ))}
      </select>
      <p aria-live="polite">
        {visible.length} open tasks match this view.{' '}
        {control.taskDates.filter((item) => item.atOrAfterSubmission).length} are scheduled at or
        after submission; confirm whether they belong before or after the bid. This is a timing
        check, not a blocker finding.
      </p>
      {!visible.length && (
        <p>
          No visible open tasks match this filter. This does not confirm that every required action
          has been recorded.
        </p>
      )}
      <ol className={styles.actions}>
        {(expanded ? visible : visible.slice(0, 8)).map((item) => (
          <li key={item.id}>
            <Link href={item.taskId ? `${base}#task-${item.taskId}` : base}>{item.title}</Link>
            <p>
              {item.label}
              {item.overdue ? ' · Past recorded date' : ''}
              {item.needsDateReview ? ' · Needs date review' : ''}
              {item.needsOwner ? ' · Confirm task owner' : ''}
              {item.atOrAfterSubmission ? ' · At or after submission deadline' : ''}
            </p>
          </li>
        ))}
      </ol>
      {visible.length > 8 && (
        <button
          className="button secondary"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show first eight tasks' : `Show all ${visible.length} matching tasks`}
        </button>
      )}
      <nav className={styles.links} aria-label="Bid control actions">
        <Link href={`${base}#pursuit-tasks`}>Manage owners and tasks</Link>
        <Link href={`${base}#response-release`}>
          Review forms, signatures and release approvals
        </Link>
        <Link href={base}>Open pursuit and assistant</Link>
      </nav>
      <p className={styles.note}>
        Task completion does not resolve a requirement. Release approvals apply to a specific
        version; submission is recorded by a user after submitting externally.
      </p>
    </section>
  );
}
