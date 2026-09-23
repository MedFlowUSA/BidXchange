import { z } from 'zod';

export const comparisonVersion = 'contractor-clause-diff-v1';
export const clauseRules = [
  {
    key: 'license',
    label: 'License classification',
    pattern: /\b(?:CSLB|licen[cs]e|class(?:ification)?\s+[ABC]|C-\d{1,2})\b/i,
  },
  { key: 'bond', label: 'Bond requirements', pattern: /\b(?:bond|bonding|surety)\b/i },
  {
    key: 'insurance',
    label: 'Insurance minimums',
    pattern: /\b(?:insurance|liability|workers.? compensation|umbrella|insured)\b/i,
  },
  {
    key: 'deadline',
    label: 'Deadlines',
    pattern: /\b(?:deadline|due|closing|submit(?:ted)?\s+by|no later than)\b/i,
  },
  {
    key: 'meeting',
    label: 'Job walk / pre-bid meeting',
    pattern: /\b(?:job\s*walk|site\s*visit|pre[- ]?bid|conference)\b/i,
  },
  {
    key: 'scope',
    label: 'Scope of work',
    pattern: /\b(?:scope|install|replace|retrofit|construction|demoli|repair|work includes)/i,
  },
] as const;
export type Clause = { text: string; line: number };
export const comparisonItemsSchema = z
  .array(
    z.object({
      field: z.enum(['license', 'bond', 'insurance', 'deadline', 'meeting', 'scope']),
      label: z.string().min(1).max(100),
      before: z.array(z.object({ text: z.string().max(24000), line: z.number().int().positive() })),
      after: z.array(z.object({ text: z.string().max(24000), line: z.number().int().positive() })),
      status: z.enum(['changed', 'unchanged', 'unknown']),
      suggestedRequirementIds: z.array(z.uuid()).max(200),
    }),
  )
  .length(6);
export type ComparisonItem = {
  field: string;
  label: string;
  before: Clause[];
  after: Clause[];
  status: 'changed' | 'unchanged' | 'unknown';
  suggestedRequirementIds: string[];
};
export type ComparisonRequirement = { id: string; text: string; status: string; version: string };
export function compareClauses(
  before: string,
  after: string,
  requirements: ComparisonRequirement[],
): ComparisonItem[] {
  const extract = (text: string, pattern: RegExp): Clause[] =>
    text
      .split(/\r?\n/)
      .map((text, i) => ({ text, line: i + 1 }))
      .filter((c) => pattern.test(c.text));
  return clauseRules.map((rule) => {
    const old = extract(before, rule.pattern),
      next = extract(after, rule.pattern);
    return {
      field: rule.key,
      label: rule.label,
      before: old,
      after: next,
      status:
        !old.length || !next.length
          ? 'unknown'
          : JSON.stringify(old.map((c) => c.text)) === JSON.stringify(next.map((c) => c.text))
            ? 'unchanged'
            : 'changed',
      suggestedRequirementIds: requirements
        .filter((r) => rule.pattern.test(r.text))
        .map((r) => r.id),
    };
  });
}
const sourceUrl = z
  .url({ protocol: /^https$/ })
  .max(2000)
  .refine((v) => {
    const u = new URL(v);
    return !u.username && !u.password;
  });
export const comparisonInput = z.object({
  organization_id: z.uuid(),
  opportunity_id: z.uuid(),
  context: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(200),
  original_url: sourceUrl,
  amended_url: sourceUrl,
  original_text: z.string().trim().min(1).max(24000),
  amended_text: z.string().trim().min(1).max(24000),
  public_source: z.literal('on'),
});
export type SavedComparison = {
  id: string;
  label: string;
  original_url: string;
  amended_url: string;
  original_text: string;
  amended_text: string;
  original_hash: string;
  amended_hash: string;
  items: ComparisonItem[];
  requirements: ComparisonRequirement[];
  context_token: string;
  created_at: string;
  method: string;
};
export type ComparisonReview = {
  comparison_id: string;
  outcome: 'confirmed' | 'dismissed';
  note: string;
  affected_requirement_ids: string[];
  amendment_id: string | null;
  reviewed_by: string;
  reviewed_at: string;
};
export type ComparisonWorkspace = {
  entries: SavedComparison[];
  reviews: ComparisonReview[];
  context: string;
  issue?: string;
};
