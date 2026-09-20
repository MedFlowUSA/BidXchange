import { z } from 'zod';

const blankUuid = z.union([z.uuid(), z.literal('')]);
const timestamp = z.union([z.iso.datetime({ offset: true }), z.literal('')]);
const timezone = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Enter a valid time zone, such as America/Los_Angeles.');
const edit = {
  organization_id: z.uuid(),
  record_id: blankUuid,
  updated_at: timestamp,
  title: z.string().trim().min(1, 'Enter a title.').max(200),
};
const versionPair = (value: { record_id: string; updated_at: string }) =>
  Boolean(value.record_id) === Boolean(value.updated_at);
export const opportunityInput = z
  .object({
    ...edit,
    buyer: z.string().trim().max(200),
    solicitation_number: z.string().trim().max(200),
    source_url: z.union([z.url({ protocol: /^https?$/ }).max(2000), z.literal('')]),
    source_note: z.string().trim().max(2000),
    summary: z.string().trim().max(6000),
    official_deadline: timestamp,
    deadline_timezone: timezone,
  })
  .refine(versionPair, 'Refresh the record before editing.')
  .refine(
    (value) => Boolean(value.source_url || value.source_note),
    'Provide a source URL or source note.',
  );
export const pursuitInput = z.object({ organization_id: z.uuid(), opportunity_id: z.uuid() });
export const taskInput = z
  .object({
    ...edit,
    pursuit_id: z.uuid(),
    assigned_user_id: blankUuid,
    status: z.enum(['todo', 'in_progress', 'complete']),
    due_at: timestamp,
    due_timezone: timezone,
  })
  .refine(versionPair, 'Refresh the task before editing.');
