import { z } from 'zod';
export const solicitationTextLimit = 40000;
export const solicitationInputSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    url: z.union([
      z.literal(''),
      z
        .url({ protocol: /^https$/ })
        .max(500)
        .refine((value) => {
          const url = new URL(value);
          return !url.username && !url.password;
        }),
    ]),
    text: z.string().min(20).max(solicitationTextLimit),
    consent: z.literal(true),
  })
  .strict();
export type SolicitationInput = z.infer<typeof solicitationInputSchema>;
export const solicitationCandidateSchema = z
  .object({
    category: z.enum([
      'License',
      'Registration',
      'Bond',
      'Insurance',
      'Site visit',
      'Prevailing wage',
      'Certified payroll',
      'Experience',
      'Personnel',
      'Safety',
      'Forms',
      'Technical',
      'Submission',
      'Deadline',
      'Pricing format',
      'Addendum',
      'Other',
    ]),
    quote: z.string().min(10).max(1000),
    meaning: z.string().min(1).max(600),
    assessment: z.enum(['records_found', 'needs_evidence', 'needs_clarification']),
    comparison: z.string().min(1).max(600),
    companySources: z.array(z.string().min(1).max(100)).max(4),
    nextStep: z.string().min(1).max(400),
  })
  .strict();
export const solicitationOutputSchema = z
  .object({
    candidates: z.array(solicitationCandidateSchema).max(16),
    limitations: z.array(z.string().min(1).max(400)).max(6),
  })
  .strict();
export type SolicitationReview = {
  title: string;
  url: string;
  sourceHash: string;
  characters: number;
  lines: number;
  candidates: (z.infer<typeof solicitationCandidateSchema> & {
    lineStart: number;
    lineEnd: number;
    occurrences: number;
    citation: string;
  })[];
  limitations: string[];
};
