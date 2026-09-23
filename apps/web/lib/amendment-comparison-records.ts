import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ComparisonWorkspace } from './amendment-comparison';
import { comparisonItemsSchema } from './amendment-comparison';
export async function loadComparisons(
  db: SupabaseClient,
  org: string,
  target: string,
): Promise<ComparisonWorkspace> {
  try {
    const [runs, context] = await Promise.all([
      db
        .from('amendment_comparisons')
        .select(
          'id,label,original_url,amended_url,original_text,amended_text,original_hash,amended_hash,items,requirements,context_token,created_at,method',
        )
        .eq('organization_id', org)
        .eq('opportunity_id', target)
        .order('created_at', { ascending: false })
        .limit(5),
      db.rpc('decision_memory_context', { org, target }),
    ]);
    if (runs.error || context.error || !context.data) throw Error();
    const reviews = runs.data.length
      ? await db
          .from('amendment_comparison_reviews')
          .select(
            'comparison_id,outcome,note,affected_requirement_ids,amendment_id,reviewed_by,reviewed_at',
          )
          .eq('organization_id', org)
          .in(
            'comparison_id',
            runs.data.map((r) => r.id),
          )
      : { data: [], error: null };
    if (reviews.error) throw Error();
    const entries = runs.data.map((entry) => ({
      ...entry,
      items: comparisonItemsSchema.parse(entry.items),
    }));
    return { entries, reviews: reviews.data ?? [], context: context.data };
  } catch {
    return {
      entries: [],
      reviews: [],
      context: '',
      issue: 'Amendment comparisons could not be loaded. Refresh before making changes.',
    };
  }
}
