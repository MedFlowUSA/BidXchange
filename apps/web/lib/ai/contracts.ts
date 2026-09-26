import { z } from 'zod';
export const roles = [
  'organization_admin',
  'executive_approver',
  'capture_manager',
  'estimator',
  'contributor',
  'viewer',
] as const;
export type Role = (typeof roles)[number];
export const contextSchema = z
  .object({ kind: z.enum(['opportunity', 'pursuit']), id: z.uuid() })
  .strict();
export const sharedRequirementSchema = z
  .object({
    id: z.uuid(),
    updatedAt: z.string().min(1).max(60),
    consent: z.literal(true),
  })
  .strict();
export type SharedRequirement = z.infer<typeof sharedRequirementSchema>;
export type RequirementExcerpt = SharedRequirement & { text: string; truncated: boolean };
export const reviewSelectionSchema = z
  .array(sharedRequirementSchema)
  .min(1)
  .max(8)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    'Select each requirement only once.',
  );
export const requestSchema = z
  .object({
    organizationId: z.uuid(),
    requestId: z.uuid(),
    prompt: z.string().trim().min(1).max(3000),
    context: contextSchema.nullable(),
    mode: z.enum(['general', 'workspace']).default('workspace'),
    continuation: z.string().max(70000).optional(),
    sharedRequirement: sharedRequirementSchema.optional(),
    sharedRequirements: reviewSelectionSchema.optional(),
  })
  .strict()
  .refine(
    (value) => !(value.sharedRequirement && value.sharedRequirements),
    'Choose one sharing mode.',
  );
export type AssistantContext = z.infer<typeof contextSchema>;
export type Citation = {
  key: string;
  type: string;
  title: string;
  id: string;
  sourceDate: string | null;
  updatedAt: string | null;
  status: string;
  href: string | null;
};
export type Evidence = { citation: Citation; fields: Record<string, unknown> };
export const answerSchema = z
  .object({
    answer: z
      .array(
        z
          .object({ text: z.string().min(1).max(2000), sources: z.array(z.string()).max(8) })
          .strict(),
      )
      .max(8),
    risks: z.array(z.string().max(600)).max(6),
    nextAction: z.string().max(600),
  })
  .strict();
export type Answer = z.infer<typeof answerSchema> & {
  sharedRequirement?: RequirementExcerpt;
  sharedRequirements?: RequirementExcerpt[];
  requirementReview?: RequirementReview;
  proposedTasks?: ProposedTask[];
  actionToken?: string;
  citations: Citation[];
  evidence: Evidence[];
  notice: string;
  recordsCheckedAt?: string;
  continuation?: string;
};
export const proposedTaskSchema = z
  .object({
    title: z.string().min(1).max(200),
    explanation: z.string().min(1).max(600),
    sources: z.array(z.string().min(1).max(100)).min(1).max(3),
    requirementKey: z.string().max(100).nullable(),
  })
  .strict();
export type ProposedTask = z.infer<typeof proposedTaskSchema>;
export const planningAnswerSchema = answerSchema.extend({
  proposedTasks: z.array(proposedTaskSchema).max(4),
});
export const requirementReviewSchema = z
  .array(
    z
      .object({
        requirementKey: z.string().min(1).max(100),
        meaning: z.string().min(1).max(1200),
        assessment: z.enum(['records_found', 'needs_evidence', 'needs_clarification']),
        comparison: z.string().min(1).max(1200),
        companySources: z.array(z.string().min(1).max(100)).max(4),
        nextStep: z.string().min(1).max(600),
      })
      .strict(),
  )
  .min(1)
  .max(8);
export type RequirementReview = z.infer<typeof requirementReviewSchema>;
export const reviewAnswerSchema = planningAnswerSchema.extend({
  requirementReview: requirementReviewSchema,
});
export const NO_EVIDENCE =
  'I could not verify that from the records currently available to BidXchange.';
export const FEED_NOTICE =
  'No live procurement feeds are connected. Added dates refer to BidXchange entry, not official publication or a procurement search.';
export const LIMITS = {
  prompt: 3000,
  toolCalls: 6,
  records: 40,
  outputTokens: 3000,
  timeoutMs: 45000,
  bodyBytes: 80000,
};
export class AiError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export const errorMessages: Record<string, string> = {
  conversation_changed:
    'Conversation context changed or expired. Start a new conversation to read current records.',
  unauthenticated: 'Sign in to use the assistant.',
  forbidden: 'This workspace or record is unavailable to your account.',
  unavailable:
    'AI is unavailable. The model, credentials, limits and organization activation must be configured by an operator.',
  rate_limited: 'The assistant usage limit has been reached. Try again later.',
  duplicate: 'This request was already received. Wait before retrying.',
  invalid_request: 'Check your question and selected workspace.',
  invalid_tool: 'The assistant requested an unsupported operation. Try a more specific question.',
  tool_limit: 'The retrieval limit was reached. Narrow your question.',
  timeout: 'The assistant timed out. Try a shorter question.',
  cancelled: 'Generation cancelled.',
  service_unavailable: 'The model service is unavailable. Try again later.',
  invalid_answer: 'The answer did not pass response checks. Please rephrase your question.',
};
