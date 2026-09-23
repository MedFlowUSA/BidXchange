import { z } from 'zod';
import type { TenantData } from './tenant-types';
export const informationRequestInput = z
  .object({
    organization_id: z.uuid(),
    record_id: z.union([z.uuid(), z.literal('')]),
    updated_at: z.union([z.iso.datetime({ offset: true }), z.literal('')]),
    label: z.string().trim().min(1).max(200),
    assigned_user_id: z.union([z.uuid(), z.literal('')]),
    due_on: z.union([z.iso.date(), z.literal('')]),
    status: z.enum(['needs_information', 'pending_review', 'complete']),
    notes: z.string().trim().max(4000),
    passport_section: z.enum([
      '',
      'identity',
      'registrations',
      'licenses',
      'territory',
      'coverage',
      'experience',
    ]),
    passport_item: z.string().trim().max(200),
  })
  .superRefine((d, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (Boolean(d.record_id) !== Boolean(d.updated_at)) fail('Refresh the request before editing.');
    if (!d.record_id && (!d.assigned_user_id || !d.due_on || d.status !== 'needs_information'))
      fail('Choose an owner and due date for the new request.');
    if (d.assigned_user_id && !d.due_on) fail('Assigned requests need a due date.');
    if (d.status !== 'needs_information' && !d.notes)
      fail('Explain what is ready for review or why you are closing the request.');
    if (Boolean(d.passport_section) !== Boolean(d.passport_item))
      fail('Use a complete Passport link.');
  });
export const requestStatusLabels = {
  needs_information: 'Information needed',
  pending_review: 'Ready for administrator review',
  complete: 'Closed by administrator',
};
export function informationRequestQueue(data: TenantData) {
  let today = data.reviewAsOf.slice(0, 10);
  try {
    today = new Intl.DateTimeFormat('en-CA', {
      timeZone: data.organization.default_timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(data.reviewAsOf));
  } catch {}
  return data.onboarding
    .map((item) => ({
      ...item,
      overdue: item.status !== 'complete' && Boolean(item.due_on && item.due_on < today),
    }))
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        Number(a.status === 'complete') - Number(b.status === 'complete') ||
        (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999') ||
        a.label.localeCompare(b.label),
    );
}
