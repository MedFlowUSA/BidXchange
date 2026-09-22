import { z } from 'zod';
export const resolutionLabels = {
  needs_review: 'Needs review',
  supported: 'Supported by reviewed evidence',
  blocked: 'Blocked',
  awaiting_clarification: 'Awaiting clarification',
  waived: 'Documented buyer waiver',
  not_applicable: 'Not applicable — human reason recorded',
} as const;
export type RequirementResolution = {
  id: string;
  requirement_id: string;
  disposition: keyof typeof resolutionLabels;
  reason: string;
  authority_name: string;
  authority_reference: string;
  reviewed_by: string;
  reviewed_at: string;
  review_current?: boolean;
};
export const resolutionInput = z
  .object({
    organization_id: z.uuid(),
    requirement_id: z.uuid(),
    requirement_version: z.iso.datetime({ offset: true }),
    previous_id: z.union([z.uuid(), z.literal('')]),
    disposition: z.enum([
      'needs_review',
      'supported',
      'blocked',
      'awaiting_clarification',
      'waived',
      'not_applicable',
    ]),
    reason: z.string().trim().min(1).max(2000),
    evidence_review_id: z.union([z.uuid(), z.literal('')]),
    authority_name: z.string().trim().max(500),
    authority_reference: z.string().trim().max(2000),
  })
  .refine(
    (d) => d.disposition !== 'supported' || !!d.evidence_review_id,
    'Choose current approved evidence.',
  )
  .refine(
    (d) => d.disposition !== 'waived' || !!(d.authority_name && d.authority_reference),
    'Identify the issuing authority and waiver source.',
  );
