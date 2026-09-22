import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function loadManagedInvitations(db: SupabaseClient, organizationId: string) {
  const result = await db
    .from('organization_invitations')
    .select('id,email,role,status,expires_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100);
  return { ...result, reviewedAt: new Date().toISOString() };
}
