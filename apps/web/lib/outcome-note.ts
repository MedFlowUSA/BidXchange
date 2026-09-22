import { z } from 'zod';

export const outcomeDetails = z
  .object({
    date: z.iso.date(),
    source: z.string().trim().min(1).max(300),
    awardee: z.string().trim().max(200),
    amount: z
      .string()
      .trim()
      .max(40)
      .regex(
        /^(?:[0-9]+(?:\.[0-9]{1,2})? [A-Z]{3})?$/,
        'Use an amount and currency such as 850000 USD, or leave unknown.',
      ),
    reason: z.string().trim().min(1).max(300),
    debrief: z.string().trim().max(400),
    disclosure: z.enum(['not_granted', 'granted']),
  })
  .strict();

/** Persist in existing immutable, tenant-scoped follow-up notes; no duplicate outcome store. */
export function outcomeNote(note: string, details?: z.infer<typeof outcomeDetails>) {
  if (!details) return note;
  return [
    note,
    `Outcome date: ${details.date}`,
    `Official source / reference: ${details.source}`,
    `Awardee: ${details.awardee || 'Not recorded'}`,
    `Official award amount: ${details.amount || 'Not recorded'}`,
    `Reason: ${details.reason}`,
    `Debrief: ${details.debrief || 'Not recorded'}`,
    `Permission to disclose: ${details.disclosure === 'granted' ? 'Recorded by user' : 'Not granted'}`,
    'User-recorded outcome; not independently verified by BidXchange. No automatic past-performance claim or reuse.',
  ].join('\n');
}
