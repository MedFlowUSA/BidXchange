export type EvidenceReminder = {
  id: string;
  fact_id: string;
  kind: 'expired' | 'stale' | '30' | '60' | '90';
  assigned_user_id: string | null;
  acknowledged_at: string | null;
  updated_at: string;
  source: { id: string; label: string; expiration_date: string | null };
};
export type EvidenceMonitoring = {
  unavailable: boolean;
  status: {
    last_attempt_at: string | null;
    last_success_at: string | null;
    failed: boolean;
  } | null;
  reminders: EvidenceReminder[];
};
export const reminderLabels = {
  expired: 'Evidence expired',
  stale: 'Source last checked over 90 days ago',
  '30': 'Expires within 30 days',
  '60': 'Expires in 31–60 days',
  '90': 'Expires in 61–90 days',
};
export function monitorHealth(monitor: EvidenceMonitoring, asOf: string) {
  if (monitor.unavailable)
    return 'Scheduled reminders could not be loaded. Use the Radar below and retry.';
  if (monitor.status?.failed)
    return 'The last scheduled check failed. Existing reminders remain available; the scheduler will retry.';
  if (!monitor.status?.last_success_at)
    return 'The first scheduled check is pending. Use the Radar below for current dates.';
  const age = Date.parse(asOf) - Date.parse(monitor.status.last_success_at);
  if (!Number.isFinite(age) || age > 36 * 60 * 60 * 1000)
    return 'The scheduled check is overdue. Use the Radar below and contact your administrator.';
  return 'Daily evidence monitoring is running. Acknowledging a reminder does not renew evidence or approve a bid.';
}
