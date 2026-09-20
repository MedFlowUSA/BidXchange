'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { taskQueue } from '../lib/task-queue';
import { workspaceHref } from '../lib/routes';
import { displayDate } from '../lib/ai/policy';
export default function TodayTaskQueue({ data }: { data: TenantData }) {
  const [mineOnly, setMineOnly] = useState(false);
  const rows = taskQueue(data.tasks, data.userId, mineOnly, data.reviewAsOf);
  return (
    <section className="panel decision-brief" aria-labelledby="today-tasks-heading">
      <div className="eyebrow">PURSUIT FOLLOW-UP</div>
      <h2 id="today-tasks-heading">Work that needs attention</h2>
      <label>
        <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />{' '}
        Only tasks assigned to me
      </label>
      <p>
        Open tasks, earliest due first. Showing up to 20 from the first 500 visible tasks. Refresh
        to update deadlines and completed work.
      </p>
      {!rows.length ? (
        <p>
          {mineOnly
            ? 'No open tasks assigned to you in this view. Clear the filter to see unassigned and team work.'
            : 'No open tasks in this view. Add the next action, owner and deadline in a pursuit.'}
        </p>
      ) : (
        <ul className="decision-brief-list">
          {rows.slice(0, 20).map(({ task, overdue, due }) => (
            <li key={task.id}>
              <Link
                href={
                  workspaceHref('/pursuits/' + task.pursuit_id, data.organization.id) +
                  '#task-' +
                  task.id
                }
              >
                {task.title}
              </Link>
              <p>
                {data.pursuits.find((p) => p.id === task.pursuit_id)?.title ?? 'Pursuit task'} ·{' '}
                {task.status.replaceAll('_', ' ')}
              </p>
              <p>
                {overdue ? 'Overdue · ' : ''}
                {due === null
                  ? 'No confirmed due date'
                  : displayDate(
                      task.due_at,
                      task.due_timezone ?? data.organization.default_timezone,
                    )}
              </p>
              <p>
                Owner:{' '}
                {task.assigned_user_id === data.userId
                  ? 'You'
                  : task.assigned_user_id
                    ? 'Assigned workspace member'
                    : 'Unassigned — assign an owner in the pursuit'}
              </p>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 20 && (
        <p>
          {rows.length - 20} additional open tasks in this view. Open the relevant pursuit to review
          all its tasks.
        </p>
      )}
    </section>
  );
}
