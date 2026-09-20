import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { LiveOpportunity, LivePursuit, TenantData } from './tenant-types';

export const opportunityFields =
  'id,title,solicitation_number,buyer,source_url,source_note,official_deadline,deadline_timezone,summary,estimated_value,status';
export const pursuitFields = 'id,title,opportunity_id,decision,status';
export const taskFields = 'id,pursuit_id,title,status';
const selectionSchema = z
  .object({ kind: z.enum(['opportunity', 'pursuit']), id: z.uuid() })
  .strict();
export type TenantRecordSelection = z.infer<typeof selectionSchema>;
type RecordContext = Pick<TenantData, 'opportunities' | 'pursuits' | 'tasks'>;

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
  return {
    opportunities: [opportunity],
    pursuits: [pursuit],
    tasks: (tasks.data ?? []) as TenantData['tasks'],
  };
}
