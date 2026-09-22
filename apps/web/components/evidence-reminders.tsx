'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { acknowledgeReminder } from '../app/evidence-reminder-actions';
import { monitorHealth, reminderLabels, type EvidenceReminder } from '../lib/evidence-monitor';
import { workspaceHref } from '../lib/routes';
import type { TenantData } from '../lib/tenant-types';

function ReminderAcknowledgement({
  reminder,
  organizationId,
}: {
  reminder: EvidenceReminder;
  organizationId: string;
}) {
  const [state, action, pending] = useActionState(acknowledgeReminder, {
    message: '',
    success: false,
  });
  return (
    <form action={action}>
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="reminder_id" value={reminder.id} />
      <input type="hidden" name="updated_at" value={reminder.updated_at} />
      {!state.success && (
        <button className="button secondary" disabled={pending}>
          {pending ? 'Saving…' : 'Acknowledge reminder'}
        </button>
      )}
      <p role="status">{state.message}</p>
    </form>
  );
}
export default function EvidenceReminders({ data }: { data: TenantData }) {
  const [mine, setMine] = useState(false);
  const [all, setAll] = useState(false);
  const monitoring = data.evidenceMonitoring;
  if (!monitoring) return null;
  const rows = monitoring.reminders.filter((r) => !mine || r.assigned_user_id === data.userId);
  const reviewer = ['organization_admin', 'executive_approver'].includes(data.organization.role);
  return (
    <section className="panel decision-brief" aria-labelledby="evidence-reminders-title">
      <div className="eyebrow">SCHEDULED FOLLOW-UP</div>
      <h2 id="evidence-reminders-title">Evidence reminders</h2>
      <p role="status">{monitorHealth(monitoring, data.reviewAsOf)}</p>
      {monitoring.status?.last_success_at && (
        <p>
          Last successful check:{' '}
          {new Date(monitoring.status.last_success_at).toISOString().replace('T', ' ').slice(0, 19)}{' '}
          UTC.
        </p>
      )}
      <label>
        <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only
        reminders assigned to me
      </label>
      {!rows.length && (
        <p>
          {mine
            ? 'No visible reminders assigned to you. Clear the filter to review team reminders.'
            : 'No scheduled reminders in this view. Missing or restricted records may still need review.'}
        </p>
      )}
      <ul className="decision-brief-list">
        {rows.slice(0, all ? 100 : 5).map((r) => (
          <li key={r.id}>
            <Link href={workspaceHref('/company', data.organization.id) + `#fact-${r.fact_id}`}>
              {r.source.label}
            </Link>
            <p>
              {reminderLabels[r.kind]}
              {r.source.expiration_date ? ` · Expiration: ${r.source.expiration_date}` : ''}
            </p>
            <p>
              Owner:{' '}
              {r.assigned_user_id === data.userId
                ? 'You'
                : r.assigned_user_id
                  ? 'Assigned company member'
                  : 'Unassigned — ask an administrator to assign the evidence owner'}
            </p>
            {r.acknowledged_at ? (
              <p>Acknowledged; evidence still needs review.</p>
            ) : (
              (reviewer || r.assigned_user_id === data.userId) && (
                <ReminderAcknowledgement
                  key={r.id + r.updated_at}
                  reminder={r}
                  organizationId={data.organization.id}
                />
              )
            )}
          </li>
        ))}
      </ul>
      {rows.length > 5 && (
        <button className="button secondary" onClick={() => setAll(!all)}>
          {all ? 'Show fewer reminders' : 'Show all reminders'}
        </button>
      )}
      <p>
        Showing up to 100 current reminders permitted by your role. Checks run daily in UTC; batches
        are processed every 15 minutes. Corrected evidence is checked on the next scheduled pass. No
        email or SMS is sent. Linked pursuit tasks require separate human completion.
      </p>
    </section>
  );
}
