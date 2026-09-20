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
export const requestSchema = z
  .object({
    organizationId: z.uuid(),
    requestId: z.uuid(),
    prompt: z.string().trim().min(1).max(3000),
    context: contextSchema.nullable(),
    mode: z.enum(['general', 'workspace']).default('workspace'),
  })
  .strict();
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
          .object({ text: z.string().min(1).max(1000), sources: z.array(z.string()).min(1).max(8) })
          .strict(),
      )
      .max(8),
    risks: z.array(z.string().max(600)).max(6),
    nextAction: z.string().max(600),
  })
  .strict();
export type Answer = z.infer<typeof answerSchema> & {
  citations: Citation[];
  evidence: Evidence[];
  notice: string;
};
export const NO_EVIDENCE =
  'I could not verify that from the records currently available to BidXchange.';
export const FEED_NOTICE =
  'No live procurement feeds are connected. Added dates refer to BidXchange entry, not official publication or a procurement search.';
export const LIMITS = {
  prompt: 3000,
  toolCalls: 6,
  records: 40,
  outputTokens: 1800,
  timeoutMs: 45000,
  bodyBytes: 14000,
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
  invalid_answer: 'The answer could not be verified. No generated answer was released.',
};
