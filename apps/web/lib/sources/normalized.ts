import { z } from 'zod';
import { findSource } from './registry';
const text = z.string().trim().max(2000).default('');
const date = z.union([z.iso.datetime({ offset: true }), z.literal('')]).default('');
export const externalUrl = z
  .string()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    try {
      const u = new URL(value);
      return (
        u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        !u.port &&
        u.hostname.includes('.') &&
        !u.hostname.endsWith('.local') &&
        !/^\d+(\.\d+){3}$/.test(u.hostname)
      );
    } catch {
      return false;
    }
  }, 'Use an HTTPS public portal link without credentials.');
export const detailFields = {
  opportunityType: 'Opportunity type',
  naics: 'NAICS codes',
  nigp: 'NIGP codes',
  psc: 'PSC codes',
  unspsc: 'UNSPSC codes',
  place: 'Place of performance / service area',
  preference: 'Set-aside or preference',
  licenses: 'Required licenses',
  certifications: 'Required certifications',
  bonding: 'Required bonding',
  insurance: 'Required insurance',
  experience: 'Required experience',
  prequalification: 'Prequalification requirements',
  incumbent: 'Incumbent / previous award references',
  contacts: 'Buyer business contacts',
  attachments: 'Attachment links / references (one per line)',
  amendments: 'Addenda / amendment references (one per line)',
  submissionMethod: 'Submission method and buyer instructions',
} as const;
export const normalizedDetails = z
  .object({
    schema: z.literal(1),
    sourceId: z.string().refine((id) => !!findSource(id), 'Choose a supported source.'),
    ...(Object.fromEntries(Object.keys(detailFields).map((key) => [key, text])) as Record<
      keyof typeof detailFields,
      typeof text
    >),
    publishedAt: date,
    questionDeadline: date,
    siteVisit: date,
    preBidMeeting: date,
    submissionUrl: externalUrl,
    connectionMode: z.literal('manual'),
    lastSynchronizedAt: z.null(),
    dataConfidence: z.null(),
  })
  .strict();
export type NormalizedDetails = z.infer<typeof normalizedDetails>;
export function readNormalized(value: unknown) {
  return normalizedDetails.safeParse(value).data ?? null;
}
export const normalizedInput = z
  .object({
    organization_id: z.uuid(),
    record_id: z.union([z.uuid(), z.literal('')]),
    updated_at: z.union([z.iso.datetime({ offset: true }), z.literal('')]),
    title: z.string().trim().min(1).max(200),
    buyer: z.string().trim().min(1).max(200),
    solicitation_number: z.string().trim().min(1).max(200),
    source_url: externalUrl.refine(Boolean, 'Enter the source opportunity URL.'),
    summary: z.string().trim().max(6000),
    source_note: z.string().trim().min(1).max(2000),
    official_deadline: date,
    deadline_timezone: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }),
    estimated_value: z.union([
      z.literal(''),
      z
        .string()
        .max(16)
        .regex(/^\d+(\.\d{1,2})?$/),
    ]),
    details: normalizedDetails,
    confirmed: z.literal('yes'),
  })
  .refine((v) => Boolean(v.record_id) === Boolean(v.updated_at), 'Refresh before editing.');

export const registrationInput = z
  .object({
    organization_id: z.uuid(),
    source_id: z.string().refine((id) => !!findSource(id)),
    updated_at: z.union([z.iso.datetime({ offset: true }), z.literal('')]),
    registration_status: z.enum([
      'unknown',
      'not_registered',
      'in_progress',
      'registered',
      'expired',
    ]),
    vendor_number: z.string().trim().max(200),
    evidence_reference: z.string().trim().max(2000),
    portal_url: externalUrl,
    expires_on: z.union([z.iso.date(), z.literal('')]),
    schedule_number: z.string().trim().max(200),
  })
  .refine(
    (v) => v.registration_status !== 'registered' || !!v.evidence_reference,
    'Cite the registration evidence.',
  );
export type SourceRegistration = {
  id: string;
  source_id: string;
  updated_at: string;
  registration_status: string;
  vendor_number: string;
  evidence_reference: string;
  portal_url: string;
  expires_on: string | null;
  schedule_number: string;
};
export function scheduleEligible(
  registration: SourceRegistration | undefined,
  today = new Date().toISOString().slice(0, 10),
) {
  return (
    !!registration &&
    registration.registration_status === 'registered' &&
    !!registration.schedule_number &&
    !!registration.evidence_reference &&
    !!registration.expires_on &&
    registration.expires_on >= today
  );
}
// Adapters share normalization; transport is independently activated, never inferred from a URL.
export interface OpportunityAdapter {
  sourceId: string;
  mode: 'manual' | 'official_api' | 'authorized_portal' | 'import';
  normalize(input: unknown): NormalizedDetails;
}
export function manualAdapter(sourceId: string): OpportunityAdapter {
  if (!findSource(sourceId)) throw new Error('Unsupported source');
  return {
    sourceId,
    mode: 'manual',
    normalize(input) {
      return normalizedDetails.parse({
        ...(input as object),
        schema: 1,
        sourceId,
        connectionMode: 'manual',
        lastSynchronizedAt: null,
        dataConfidence: null,
      });
    },
  };
}
