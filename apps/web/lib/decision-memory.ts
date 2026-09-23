import { z } from 'zod';
import { decisionReasons } from './decision-reasons';

export const memoryReviewSchema = z.object({
  organization_id: z.uuid(),
  decision_id: z.uuid(),
  opportunity_id: z.uuid(),
  reason_code: z.string().refine((v) => v in decisionReasons),
  assessment: z.enum(['resolved', 'still_unresolved', 'not_applicable']),
  note: z.string().trim().min(1).max(2000),
  source_reference: z.string().trim().min(1).max(1000),
  context: z.string().regex(/^[a-f0-9]{32}$/),
  previous: z.union([z.literal(''), z.uuid()]),
  acknowledged: z.literal('on'),
});
export type MemoryEntry = {
  id: string;
  pursuit_id: string;
  reason: string;
  reason_codes: string[];
  decided_at: string;
  decided_by: string;
  opportunity_snapshot: {
    id?: string;
    title?: string;
    buyer?: string;
    solicitation_number?: string;
  } | null;
  review_snapshot: {
    requirements?: {
      id: string;
      text: string;
      citation?: string;
      status: string;
      human_finding?: string | null;
    }[];
  } | null;
  match_version: string | null;
  matched_features?: string[];
};
export type MemoryReview = {
  id: string;
  decision_id: string;
  reason_code: string;
  assessment: string;
  note: string;
  source_reference: string;
  reviewed_by: string;
  reviewed_at: string;
  context_token: string;
};
export type DecisionMemory = {
  entries: MemoryEntry[];
  reviews: MemoryReview[];
  opportunityId?: string;
  context?: string;
  hasMore?: boolean;
  issue?: string;
  page?: number;
  query?: string;
};
export function reasonLabel(code: string) {
  return (
    (
      {
        bond: 'Bond capacity',
        license: 'License classification gap',
        site_visit: 'Job walk / pre-bid conflict',
        deadline: 'Timeline / deadline',
      } as Record<string, string>
    )[code] ??
    decisionReasons[code as keyof typeof decisionReasons] ??
    code
  );
}
export function matchLabel(token: string) {
  const [kind, ...value] = token.split(':');
  return `${kind === 'agency' ? 'Same agency' : kind === 'trade' ? 'Same trade code in source' : 'Shared requirement pattern'}: ${value.join(':').replaceAll('_', ' ')}`;
}
export function reviewStatus(review: MemoryReview | undefined, context: string | undefined) {
  if (!review || !context || review.context_token !== context) return 'Needs review';
  return (
    (
      {
        resolved: 'Resolved for this notice',
        still_unresolved: 'Still unresolved',
        not_applicable: 'Does not apply to this notice',
      } as Record<string, string>
    )[review.assessment] ?? 'Needs review'
  );
}
export function requirementFinding(
  row: NonNullable<NonNullable<MemoryEntry['review_snapshot']>['requirements']>[number],
) {
  if (row.human_finding === 'blocked' || (!row.human_finding && row.status === 'blocked'))
    return 'Recorded blocker';
  if (row.human_finding === 'supported') return 'Human-reviewed support';
  if (['waived', 'not_applicable'].includes(row.human_finding ?? ''))
    return 'Human exception / not applicable';
  if (row.human_finding === 'awaiting_clarification' || row.status === 'missing_information')
    return 'Awaiting clarification';
  return 'Support not confirmed in this snapshot';
}
