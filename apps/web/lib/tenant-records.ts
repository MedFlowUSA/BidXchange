import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { LiveOpportunity, LivePursuit, TenantData } from './tenant-types';

export const opportunityFields =
  'id,title,solicitation_number,buyer,source_url,source_note,official_deadline,deadline_timezone,summary,estimated_value,status,updated_at';
export const pursuitFields = 'id,title,opportunity_id,decision,status,updated_at';
export const taskFields =
  'id,pursuit_id,title,status,updated_at,assigned_user_id,due_at,due_timezone';
const selectionSchema = z
  .object({ kind: z.enum(['opportunity', 'pursuit']), id: z.uuid() })
  .strict();
export type TenantRecordSelection = z.infer<typeof selectionSchema>;
type RecordContext = Pick<
  TenantData,
  | 'opportunities'
  | 'pursuits'
  | 'tasks'
  | 'requirements'
  | 'evidenceReviews'
  | 'evidenceReviewsEnabled'
  | 'decisionsEnabled'
  | 'decisionContext'
  | 'decisions'
  | 'resolutionsEnabled'
  | 'resolutions'
  | 'resolutionHistory'
>;

// The caller supplies its validated user-session client; never use an operator client here.
export async function loadRecordContext(
  db: SupabaseClient,
  organizationId: string,
  selection: TenantRecordSelection,
): Promise<RecordContext | null> {
  if (!z.uuid().safeParse(organizationId).success || !selectionSchema.safeParse(selection).success)
    return null;
  const scoped = <Fields extends string>(table: string, fields: Fields) =>
    db.from(table).select(fields).eq('organization_id', organizationId);
  const decisionsEnabled = process.env.BIDXCHANGE_DECISIONS_ENABLED === 'true';
  let decisionContext: string | undefined;
  if (decisionsEnabled && selection.kind === 'pursuit') {
    const context = await db.rpc('pursuit_decision_context', {
      org: organizationId,
      pursuit: selection.id,
    });
    if (context.error || typeof context.data !== 'string')
      throw new Error('Decision context could not be loaded. Please retry.');
    decisionContext = context.data;
  }
  const readOpportunity = async (id: string) => {
    const { data, error } = await scoped('opportunities', opportunityFields)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error('Record data could not be loaded. Please retry.');
    return data as LiveOpportunity | null;
  };
  if (selection.kind === 'opportunity') {
    const opportunity = await readOpportunity(selection.id);
    if (!opportunity) return null;
    const { data, error } = await scoped('pursuits', pursuitFields)
      .eq('opportunity_id', opportunity.id)
      .order('id')
      .limit(500);
    if (error) throw new Error('Record data could not be loaded. Please retry.');
    return { opportunities: [opportunity], pursuits: (data ?? []) as LivePursuit[], tasks: [] };
  }
  const { data, error } = await scoped('pursuits', pursuitFields)
    .eq('id', selection.id)
    .maybeSingle();
  if (error) throw new Error('Record data could not be loaded. Please retry.');
  const pursuit = data as LivePursuit | null;
  if (!pursuit) return null;
  const opportunity = await readOpportunity(pursuit.opportunity_id);
  if (!opportunity) return null;
  const tasks = await scoped('pursuit_tasks', taskFields)
    .eq('pursuit_id', pursuit.id)
    .order('id')
    .limit(500);
  if (tasks.error) throw new Error('Record data could not be loaded. Please retry.');
  const requirements = await scoped(
    'pursuit_requirements',
    'id,pursuit_id,requirement,citation,status,owner_user_id,updated_at',
  )
    .eq('pursuit_id', pursuit.id)
    .order('id')
    .limit(501);
  if (requirements.error) throw new Error('Record data could not be loaded. Please retry.');
  const evidenceReviewsEnabled = process.env.BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED === 'true';
  let evidenceReviews: NonNullable<TenantData['evidenceReviews']> = [];
  if (evidenceReviewsEnabled && requirements.data?.length) {
    const reviews = await scoped(
      'current_evidence_use_reviews',
      'id,requirement_id,fact_id,applicability,proposal_use,approval_current,reason,reviewed_by,reviewed_at',
    )
      .in(
        'requirement_id',
        requirements.data.map((row) => row.id),
      )
      .order('reviewed_at', { ascending: false })
      .limit(500);
    if (reviews.error) throw new Error('Evidence reviews could not be loaded. Please retry.');
    evidenceReviews = (reviews.data ?? []) as NonNullable<TenantData['evidenceReviews']>;
  }
  let decisions: NonNullable<TenantData['decisions']> = [];
  if (decisionsEnabled) {
    const history = await scoped(
      'pursuit_decision_history',
      'id,decision,reason,conditions,context_token,decided_by,decided_at',
    )
      .eq('pursuit_id', pursuit.id)
      .order('decided_at', { ascending: false })
      .limit(20);
    if (history.error) throw new Error('Decision history could not be loaded. Please retry.');
    decisions = (history.data ?? []) as NonNullable<TenantData['decisions']>;
  }
  const resolutionsEnabled = process.env.BIDXCHANGE_RESOLUTIONS_ENABLED === 'true';
  let resolutions: NonNullable<TenantData['resolutions']> = [],
    resolutionHistory: NonNullable<TenantData['resolutionHistory']> = [];
  if (resolutionsEnabled) {
    const fields =
      'id,requirement_id,disposition,reason,authority_name,authority_reference,reviewed_by,reviewed_at';
    const [current, history] = await Promise.all([
      scoped(
        'current_requirement_resolutions',
        'id,requirement_id,disposition,reason,authority_name,authority_reference,reviewed_by,reviewed_at,review_current',
      )
        .eq('pursuit_id', pursuit.id)
        .order('requirement_id')
        .limit(501),
      scoped('requirement_resolution_history', fields)
        .eq('pursuit_id', pursuit.id)
        .order('reviewed_at', { ascending: false })
        .order('sequence', { ascending: false })
        .limit(100),
    ]);
    if (current.error || history.error)
      throw new Error('Requirement reviews could not be loaded. Please retry.');
    resolutions = (current.data ?? []) as NonNullable<TenantData['resolutions']>;
    resolutionHistory = (history.data ?? []) as NonNullable<TenantData['resolutionHistory']>;
  }
  return {
    resolutionsEnabled,
    resolutions,
    resolutionHistory,
    decisionsEnabled,
    decisionContext,
    decisions,
    evidenceReviewsEnabled,
    evidenceReviews,
    opportunities: [opportunity],
    pursuits: [pursuit],
    tasks: (tasks.data ?? []) as TenantData['tasks'],
    requirements: (requirements.data ?? []) as TenantData['requirements'],
  };
}
