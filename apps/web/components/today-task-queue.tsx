'use client';
import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { taskInboxHref, taskInboxPageSize, taskInboxMaxPage } from '../lib/task-inbox';
import { workspaceHref } from '../lib/routes';
import { displayDate } from '../lib/ai/policy';
import styles from './today-task-queue.module.css';

export default function TodayTaskQueue({ data }: { data: TenantData }) {
  const inbox = data.taskInbox;
  const filters = inbox?.filters ?? { owner: 'all', timing: 'all', page: 0 };
  const first = taskInboxHref(data.organization.id, { ...filters, page: 0 });
  return (
    <section className={`panel ${styles.inbox}`} aria-labelledby="today-tasks-heading">
      <div className="eyebrow">YOUR BID WORK</div>
      <div className={styles.heading}>
        <div>
          <h2 id="today-tasks-heading" tabIndex={-1}>
            Work that needs attention
          </h2>
          <p>Find the next task, check its deadline, and open the bid to take action.</p>
        </div>
        <button type="button" className="button secondary" onClick={() => window.location.reload()}>
          Refresh tasks
        </button>
      </div>
      <form
        key={`${filters.owner}-${filters.timing}`}
        action="/dashboard#today-tasks-heading"
        method="get"
        className={styles.filters}
        aria-label="Filter task inbox"
      >
        <input type="hidden" name="organization" value={data.organization.id} />
        <label>
          Task owner
          <select name="task_owner" defaultValue={filters.owner}>
            <option value="all">All team tasks</option>
            <option value="mine">Assigned to me</option>
            <option value="unassigned">Needs an owner</option>
          </select>
        </label>
        <label>
          Deadline
          <select name="task_timing" defaultValue={filters.timing}>
            <option value="all">All open tasks</option>
            <option value="overdue">Overdue</option>
            <option value="week">Due in the next 7 days</option>
            <option value="undated">Needs a deadline</option>
          </select>
        </label>
        <button type="submit" className="button primary">
          Apply filters
        </button>
      </form>
      {!inbox || inbox.error ? (
        <div role="alert" className={styles.empty}>
          <h3>Tasks could not be loaded</h3>
          <p>Refresh to try again. This does not mean there are no open tasks.</p>
          <Link href={workspaceHref('/pursuits', data.organization.id)}>
            Open pursuits to review work
          </Link>
        </div>
      ) : (
        <>
          <p className={styles.caption}>
            Earliest deadline first; tasks without a date come last. Completed tasks are excluded.
            Checked {displayDate(inbox.asOf, data.organization.default_timezone)}.
          </p>
          {filters.timing === 'week' && (
            <p className={styles.caption}>
              The next seven days starts at the checked time above. Each task shows its saved time
              zone.
            </p>
          )}
          {!inbox.rows.length ? (
            <div className={styles.empty}>
              <h3>
                {filters.page > 0 ? 'No tasks on this page' : 'No open tasks match this view'}
              </h3>
              <p>
                {filters.page > 0
                  ? 'Tasks may have moved or been completed. Return to the first page to review the current queue.'
                  : 'Try another owner or deadline filter. Add tasks with an owner and due date inside a pursuit.'}
              </p>
              <Link
                href={
                  filters.page > 0
                    ? first
                    : taskInboxHref(data.organization.id, { owner: 'all', timing: 'all', page: 0 })
                }
              >
                {filters.page > 0 ? 'Return to first page' : 'Show all team tasks'}
              </Link>
              {' · '}
              <Link href={workspaceHref('/pursuits', data.organization.id)}>Open pursuits</Link>
            </div>
          ) : (
            <ul className={styles.tasks}>
              {inbox.rows.map(({ task, pursuitTitle }) => {
                const due = task.due_at ? Date.parse(task.due_at) : NaN;
                const overdue = Number.isFinite(due) && due < Date.parse(inbox.asOf);
                return (
                  <li key={task.id} className={styles.task}>
                    <div>
                      <p className={styles.pursuit}>
                        {pursuitTitle ?? 'Pursuit record unavailable'}
                      </p>
                      <h3>
                        <Link
                          href={
                            workspaceHref('/pursuits/' + task.pursuit_id, data.organization.id) +
                            '#task-' +
                            task.id
                          }
                        >
                          {task.title}
                        </Link>
                      </h3>
                      <p>
                        {task.status === 'in_progress' ? 'In progress' : 'Not started'}
                        {task.priority &&
                          ` · ${task.priority[0].toUpperCase() + task.priority.slice(1)} priority`}
                      </p>
                      <p>
                        Owner:{' '}
                        {task.assigned_user_id === data.userId
                          ? 'You'
                          : task.assigned_user_id
                            ? 'Assigned team member'
                            : 'Unassigned — choose an owner in the pursuit'}
                      </p>
                    </div>
                    <div className={styles.deadline}>
                      <span className={overdue ? styles.overdue : styles.dateLabel}>
                        {overdue ? 'Overdue' : Number.isFinite(due) ? 'Due' : 'Needs a deadline'}
                      </span>
                      {Number.isFinite(due) && (
                        <p>
                          {displayDate(
                            task.due_at,
                            task.due_timezone ?? data.organization.default_timezone,
                          )}
                        </p>
                      )}
                      <Link
                        className="button secondary"
                        href={
                          workspaceHref('/pursuits/' + task.pursuit_id, data.organization.id) +
                          '#task-' +
                          task.id
                        }
                        aria-label={`Open task: ${task.title}`}
                      >
                        Open task
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <nav className={styles.pages} aria-label="Task pages">
            <span>
              Page {filters.page + 1}
              {inbox.rows.length > 0 &&
                ` · ${filters.page * taskInboxPageSize + 1}–${filters.page * taskInboxPageSize + inbox.rows.length} in this view`}
            </span>
            {filters.page > 0 && (
              <Link
                className="button secondary"
                href={taskInboxHref(data.organization.id, { ...filters, page: filters.page - 1 })}
              >
                Previous tasks
              </Link>
            )}
            {inbox.hasNext && (
              <Link
                className="button secondary"
                href={taskInboxHref(data.organization.id, { ...filters, page: filters.page + 1 })}
              >
                Next tasks
              </Link>
            )}
          </nav>
          {filters.page === taskInboxMaxPage && (
            <p>Narrow the owner or deadline filter to review more tasks.</p>
          )}
          <p className={styles.caption}>
            New assignments and completed work can change the order. Refresh for the latest queue.
          </p>
        </>
      )}
    </section>
  );
}
