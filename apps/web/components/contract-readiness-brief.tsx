import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { contractReadiness } from '../lib/contract-readiness';
import styles from './contract-readiness-brief.module.css';

export default function ContractReadinessBrief({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const brief = contractReadiness(data, pursuitId);
  if (!brief) return null;
  const { map } = brief;
  const base = `/pursuits/${pursuitId}?organization=${data.organization.id}`;
  const qualification = `/pursuits/${pursuitId}/qualification?organization=${data.organization.id}`;
  return (
    <section className="panel" aria-labelledby="contract-readiness-title">
      <div className="eyebrow">Contract Readiness Brief</div>
      <h2 id="contract-readiness-title">
        What stands between this opportunity and a reviewed bid?
      </h2>
      <p>Use the recorded evidence to decide where your team should spend its next hour.</p>
      {brief.uncertain && (
        <p className="info-note">
          This brief has missing, unavailable or limited records. Unknown does not mean qualified or
          disqualified. Review the detailed evidence before deciding.
        </p>
      )}
      {map.deadlinePassed && (
        <p className="info-note">
          The recorded submission deadline has passed. Confirm an official extension before
          proceeding.
        </p>
      )}
      <div className={styles.grid}>
        <div>
          <h3>Does this fit our company?</h3>
          <strong>
            {brief.supported} of {map.rows.length} recorded requirements have current support or a
            waiver
          </strong>
          <p>
            These are human review findings, not a complete eligibility assessment. Linked evidence
            can still need renewal or review.
          </p>
          <Link href={qualification}>Trace company evidence</Link>
        </div>
        <div>
          <h3>What could stop this bid?</h3>
          <strong>
            {map.blocked} recorded blockers · {map.needingAction} requirements needing action
          </strong>
          <p>
            {map.rows[0]?.actions[0]?.title ??
              'Review the full notice and confirm that all requirements are recorded.'}
          </p>
          <Link href={qualification}>Resolve qualification gaps</Link>
        </div>
        <div>
          <h3>Can we deliver?</h3>
          <strong>Delivery capacity not established</strong>
          <p>
            Confirm crew availability, equipment, supplier quotes, costs and overlapping
            commitments. Completed tasks alone do not prove capacity or profitability.
          </p>
          <Link href={`${base}#pursuit-tasks`}>Assign a delivery review</Link>
        </div>
        <div>
          <h3>What needs to happen next?</h3>
          <strong>
            {brief.actions.length} open tasks · {brief.overdue} overdue · {brief.unassigned}{' '}
            unassigned
          </strong>
          <p>
            Overdue work appears first, followed by work without an owner. Requirement gaps need
            separate review even when tasks are complete.
          </p>
          <Link href={`${base}#pursuit-tasks`}>Manage owners and deadlines</Link>
        </div>
        <div>
          <h3>What changed?</h3>
          <strong>{brief.changed.length} requirements have affected response sections</strong>
          <p>
            {brief.pendingSource
              ? 'A source update is pending review. Compare it with the official notice.'
              : 'No pending source update is recorded in this snapshot. This is not confirmation that the portal has no new amendments.'}{' '}
            Source or review-context changes require another response review.
          </p>
          <Link href={`${base}#response-release`}>Review response and approvals</Link>
        </div>
      </div>
      <details className={styles.actions}>
        <summary>Next recorded actions ({brief.actions.length})</summary>
        {!brief.actions.length && (
          <p>
            No open tasks are recorded. Review the gaps above before concluding the work is
            complete.
          </p>
        )}
        <ol>
          {brief.actions.slice(0, 10).map((task) => (
            <li key={task.id}>
              <Link href={`${base}#task-${task.id}`}>{task.title}</Link>
              <p>
                {task.overdue ? 'Overdue · ' : ''}Owner:{' '}
                {task.unassigned
                  ? 'Unassigned'
                  : task.assigned_user_id === data.userId
                    ? 'You'
                    : task.assigned_user_id}{' '}
                · Due: {task.missingDeadline ? 'Not established' : task.due_at}
              </p>
            </li>
          ))}
        </ol>
        {brief.actions.length > 10 && (
          <Link href={`${base}#pursuit-tasks`}>View all open tasks</Link>
        )}
      </details>
      <p className={styles.note}>
        Visible records as of {data.reviewAsOf}. Refresh after changes. This brief does not
        authorize submission or predict an award.
      </p>
    </section>
  );
}
