import { z } from 'zod';
export const checklistLabels = {
  instructions: 'Official submission instructions',
  attachments: 'Required attachments',
  forms: 'Required forms',
  signatures: 'Required signatures',
  certifications: 'Required certifications',
  amendments: 'Amendment acknowledgments',
  pricing: 'Pricing document',
  filenames: 'File naming',
  formats: 'File formats',
  limits: 'Size and page limits',
  source_review: 'Complete source and amendment review',
} as const;
export const gateLabels = {
  pricing: 'Pricing approved',
  compliance: 'Compliance review completed',
  final: 'Final response approved',
  submission: 'Submission authorized',
} as const;
export const followupLabels = {
  agency_question: 'Agency question',
  clarification: 'Clarification',
  interview: 'Presentation / interview',
  best_final_offer: 'Best-and-final-offer request',
  award: 'Award recorded',
  loss: 'Loss recorded',
  cancelled: 'Cancellation',
  debrief_requested: 'Debrief requested',
  debrief_received: 'Debrief received',
  lessons_learned: 'Lessons learned',
} as const;
export const checklistItem = z
  .object({
    status: z.enum(['confirmed', 'missing', 'needs_review', 'not_applicable', 'unknown']),
    reference: z.string().trim().max(2000),
  })
  .strict()
  .refine(
    (v) => !['confirmed', 'not_applicable'].includes(v.status) || !!v.reference,
    'Provide the confirmation reference or not-applicable reason.',
  );
export const fileManifest = z
  .object({
    name: z.string().trim().min(1).max(200),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    reference: z.string().trim().min(1).max(1000),
  })
  .strict();
export const releaseChecklist = z
  .object({
    instructions: checklistItem,
    attachments: checklistItem,
    forms: checklistItem,
    signatures: checklistItem,
    certifications: checklistItem,
    amendments: checklistItem,
    pricing: checklistItem,
    filenames: checklistItem,
    formats: checklistItem,
    limits: checklistItem,
    source_review: checklistItem,
    method: z.string().trim().min(1).max(200),
    portal: z.string().trim().min(1).max(2000),
    source_version: z.string().trim().min(1).max(500),
    reviewed_at: z.iso.datetime({ offset: true }),
    submitter: z.uuid(),
    files: z.array(fileManifest).min(1).max(30),
  })
  .strict();
export type ReleaseChecklist = z.infer<typeof releaseChecklist>;
export type ReleaseStatus = {
  state: string;
  current: boolean;
  blockers: string[];
  approvals: Record<string, boolean>;
  approval_ids: Record<string, string>;
  checksum: string;
  submission_id: string | null;
};
export type ResponseRelease = {
  id: string;
  sequence: number;
  package_id: string;
  package_version: string;
  context_token: string;
  checksum: string;
  created_by: string;
  created_at: string;
  snapshot: {
    title: string;
    response: unknown;
    checklist: ReleaseChecklist;
    opportunity: Record<string, string | null>;
    company: Record<string, string | null>;
    requirements: unknown[];
    bid_decision: unknown;
  };
  status?: ReleaseStatus;
};
export type ApprovalRecord = {
  id: string;
  release_id: string;
  sequence: number;
  approval_type: keyof typeof gateLabels;
  decision: string;
  approver: string;
  role_at_decision: string;
  decided_at: string;
  rationale: string;
  conditions: string;
  checksum: string;
};
export type SubmissionRecord = {
  id: string;
  release_id: string;
  sequence: number;
  kind: string;
  previous_id: string | null;
  submitted_by: string;
  recorded_by: string;
  submitted_at: string;
  recorded_at: string;
  details: Record<string, string>;
  authorization_id: string;
  checksum: string;
};
export type FollowupRecord = {
  id: string;
  release_id: string;
  event_type: keyof typeof followupLabels;
  note: string;
  due_at: string | null;
  recorded_by: string;
  recorded_at: string;
};
export type ReleaseWorkspace = {
  enabled: boolean;
  context?: string;
  versions: ResponseRelease[];
  approvals: ApprovalRecord[];
  submissions: SubmissionRecord[];
  followups: FollowupRecord[];
  partial?: boolean;
};
export const releaseActionInput = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('freeze'),
      organization: z.uuid(),
      pursuit: z.uuid(),
      package: z.uuid(),
      version: z.iso.datetime({ offset: true }),
      context: z.string().length(64),
      checklist: releaseChecklist,
    })
    .strict(),
  z
    .object({
      action: z.literal('approve'),
      organization: z.uuid(),
      release: z.uuid(),
      checksum: z.string().length(64),
      gate: z.enum(['pricing', 'compliance', 'final', 'submission']),
      decision: z.enum(['approved', 'rejected', 'revoked']),
      rationale: z.string().trim().min(1).max(2000),
      conditions: z.string().max(2000),
      previous: z.uuid().nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal('submit'),
      organization: z.uuid(),
      release: z.uuid(),
      checksum: z.string().length(64),
      previous: z.uuid().nullable(),
      confirmed: z.literal(true),
      details: z
        .object({
          kind: z.enum(['initial', 'correction', 'resubmission']),
          method: z.string().trim().min(1).max(200),
          portal: z.string().trim().min(1).max(2000),
          submitted_at: z.iso.datetime({ offset: true }),
          confirmation: z.string().max(500),
          receipt: z.string().max(2000),
          receipt_limitation: z.string().max(2000),
          notes: z.string().trim().min(1).max(2000),
          followup_at: z.union([z.iso.datetime({ offset: true }), z.literal('')]),
        })
        .strict()
        .refine(
          (d) => !!d.receipt.trim() || !!d.receipt_limitation.trim(),
          'Record receipt reference or its explicit limitation.',
        ),
    })
    .strict(),
  z
    .object({
      action: z.literal('followup'),
      organization: z.uuid(),
      release: z.uuid(),
      event: z.enum([
        'agency_question',
        'clarification',
        'interview',
        'best_final_offer',
        'award',
        'loss',
        'cancelled',
        'debrief_requested',
        'debrief_received',
        'lessons_learned',
      ]),
      note: z.string().trim().min(1).max(2000),
      due: z.union([z.iso.datetime({ offset: true }), z.literal('')]),
    })
    .strict(),
]);
