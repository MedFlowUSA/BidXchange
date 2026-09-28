import { z } from 'zod';

export const samFilters = z
  .object({
    title: z.string().trim().max(120),
    naics: z.string().regex(/^$|^\d{6}$/),
    state: z
      .string()
      .regex(
        /^$|^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|PR|VI|GU|AS|MP)$/,
      ),
    postedFrom: z.iso.date(),
    postedTo: z.iso.date(),
    noticeType: z.enum(['', 'o', 'k', 'r', 'p']),
  })
  .strict();
export type SamFilters = z.infer<typeof samFilters>;
export function validateSamFilters(input: unknown, now = new Date()): SamFilters {
  const filters = samFilters.parse(input);
  const days = (Date.parse(filters.postedTo) - Date.parse(filters.postedFrom)) / 86400000;
  if (days < 0 || days > 30 || filters.postedTo > now.toISOString().slice(0, 10))
    throw new Error('Choose a past publication window of at most 31 calendar days.');
  if (!filters.title && !filters.naics)
    throw new Error('Enter a title keyword or a six-digit NAICS code.');
  return filters;
}
export function defaultSamFilters(now = new Date()): SamFilters {
  return {
    title: '',
    naics: '',
    state: '',
    postedFrom: new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10),
    postedTo: now.toISOString().slice(0, 10),
    noticeType: '',
  };
}
const identity = { organizationId: z.uuid(), requestId: z.uuid() };
export const samRequest = z.discriminatedUnion('action', [
  z
    .object({
      ...identity,
      action: z.literal('prepare'),
      prompt: z.string().trim().min(1).max(3000),
    })
    .strict(),
  z
    .object({
      ...identity,
      action: z.literal('search'),
      filters: samFilters,
      consent: z.literal(true),
    })
    .strict(),
]);
export type SamCompanyCode = { code: string; factId: string; label: string };
export type SamResult = {
  id: string;
  title: string;
  agency: string | null;
  solicitationNumber: string | null;
  url: string | null;
  published: string | null;
  deadline: string | null;
  deadlineInstant: string | null;
  naics: string | null;
  state: string | null;
  status: string;
  noticeType: string | null;
  companyEvidence: SamCompanyCode[];
};
export type SamReport = {
  filters: SamFilters;
  checkedAt: string;
  total: number;
  returned: number;
  partial: boolean;
  warnings: string[];
  results: SamResult[];
  canSave: boolean;
  defaultTimezone: string;
};
export function samSearchIntent(question: string) {
  return (
    /\b(?:sam\.?gov|sam)\b/i.test(question) &&
    /\b(?:find|search|look|check|see|bids?|opportunit(?:y|ies))\b/i.test(question)
  );
}
