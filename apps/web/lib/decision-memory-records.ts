import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DecisionMemory, MemoryEntry, MemoryReview } from './decision-memory';

export async function loadDecisionMemory(
  db: SupabaseClient,
  org: string,
  opportunityId?: string,
  page = 0,
  query = '',
): Promise<DecisionMemory> {
  try {
    if (opportunityId) {
      const result = await db.rpc('similar_no_bid_decisions', { org, target: opportunityId });
      if (result.error || !result.data) throw Error();
      const entries = result.data.matches as MemoryEntry[];
      let reviews: MemoryReview[] = [];
      if (entries.length) {
        // Bounded five matches x at most sixteen reasons; latest-per-reason RPC avoids
        // losing a current review behind a long historical sequence.
        const resultReviews = await db.rpc('current_decision_memory_reviews', {
          org,
          target: opportunityId,
          decision_ids: entries.map((e) => e.id),
        });
        if (resultReviews.error) throw Error();
        reviews = resultReviews.data ?? [];
      }
      return { entries, reviews, opportunityId, context: result.data.context };
    }
    let request = db
      .from('pursuit_decision_history')
      .select(
        'id,pursuit_id,reason,reason_codes,decided_at,decided_by,opportunity_snapshot,review_snapshot,match_version',
      )
      .eq('organization_id', org)
      .eq('decision', 'no_bid')
      .order('decided_at', { ascending: false })
      .order('id');
    const safe = query
      .slice(0, 80)
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim();
    if (safe)
      request = request.or(
        `reason.ilike.%${safe}%,opportunity_snapshot->>title.ilike.%${safe}%,opportunity_snapshot->>buyer.ilike.%${safe}%`,
      );
    const result = await request.range(page * 25, page * 25 + 25);
    if (result.error) throw Error();
    return {
      entries: (result.data ?? []).slice(0, 25) as MemoryEntry[],
      reviews: [],
      hasMore: (result.data?.length ?? 0) > 25,
      page,
      query: safe,
    };
  } catch {
    return {
      entries: [],
      reviews: [],
      opportunityId,
      issue:
        'Decision history could not be loaded. Refresh or contact your workspace administrator.',
    };
  }
}
