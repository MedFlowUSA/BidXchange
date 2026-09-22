import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EvidenceMonitoring, EvidenceReminder } from './evidence-monitor';

export async function loadEvidenceMonitoring(
  db: SupabaseClient,
  organizationId: string,
): Promise<EvidenceMonitoring> {
  const [reminders, status] = await Promise.all([
    db
      .from('evidence_reminders')
      .select(
        'id,fact_id,kind,assigned_user_id,acknowledged_at,updated_at,source:profile_facts!inner(id,label,expiration_date)',
      )
      .eq('organization_id', organizationId)
      .is('resolved_at', null)
      .order('updated_at', { ascending: false })
      .limit(100)
      .overrideTypes<EvidenceReminder[], { merge: false }>(),
    db.rpc('evidence_monitor_status', { org: organizationId }),
  ]);
  return {
    unavailable: !!(reminders.error || status.error),
    reminders: reminders.data ?? [],
    status: status.data?.[0] ?? null,
  };
}
