import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { bidControl } from '../lib/bid-control';
import styles from './qualification-workspace.module.css';

export default function BidControl({ data, pursuitId }: { data: TenantData; pursuitId: string }) {
  const control = bidControl(data, pursuitId);
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
      <h3>Recorded dates and follow-ups</h3>
      <p>
        Submission deadline and open task dates only. Record job walks, questions deadlines and bond
        requests as tasks after checking the notice. Missing dates are shown below; this is not a
        complete solicitation calendar.
      </p>
      {!control.dates.length && (
        <p>
          No dates or tasks are visible. Open the pursuit to record its source and next actions.
        </p>
      )}
      <ol className={styles.actions}>
        {control.dates.slice(0, 8).map((item) => (
          <li key={item.id}>
            <Link href={item.taskId ? `${base}#task-${item.taskId}` : base}>{item.title}</Link>
            <p>
              {item.label}
              {item.overdue ? ' · Past recorded date' : ''}
              {item.needsDateReview ? ' · Needs date review' : ''}
            </p>
          </li>
        ))}
      </ol>
      {control.dates.length > 8 && (
        <p>Showing the first eight entries. Open pursuit tasks to review all visible work.</p>
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
