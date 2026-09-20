import 'server-only';
import { z } from 'zod';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServer } from './supabase/server';
import type { OrganizationChoice } from './routes';
import type { TenantData } from './tenant-types';
import {
  loadRecordContext,
  opportunityFields,
  pursuitFields,
  taskFields,
  type TenantRecordSelection,
} from './tenant-records';

export async function accountContext() {
  const supabase = await createSupabaseServer();
  if (!supabase) return { supabase: null, user: null, choices: [] as OrganizationChoice[] };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, choices: [] as OrganizationChoice[] };
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('organization_id,role,organizations(id,operating_name)')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (error)
    throw new Error(
      'Workspace setup is unavailable. Check database migrations and organization access.',
    );
  const choices = (data ?? []).flatMap((m) => {
    const org = m.organizations as unknown as { id: string; operating_name: string } | null;
    return org ? [{ ...org, role: m.role as string }] : [];
  });
  return { supabase, user, choices };
}
export async function loadTenant(
  organizationId: string | undefined,
  next: string,
  record?: TenantRecordSelection,
) {
  const account = await accountContext();
  if (!account.user || !account.supabase) redirect('/login?next=' + encodeURIComponent(next));
  if (organizationId && !z.uuid().safeParse(organizationId).success) notFound();
  const choice = organizationId
    ? account.choices.find((o) => o.id === organizationId)
    : account.choices.length === 1
      ? account.choices[0]
      : undefined;
  if (organizationId && !choice) notFound();
  if (!choice) return { account, data: null };
  const db = account.supabase;
  const id = choice.id;
  const recordContext = record ? await loadRecordContext(db, id, record) : undefined;
  if (record && !recordContext) notFound();
  const results = await Promise.all([
    db.from('organizations').select('*').eq('id', id).single(),
    db
      .from('profile_facts')
      .select(
        'id,fact_type,label,value,verification_status,source_reference,source_note,verified_by,verified_at,effective_date,expiration_date,updated_at,owner_user_id,sensitivity',
      )
      .eq('organization_id', id)
      .order('created_at')
      .limit(500),
    db
      .from('onboarding_items')
      .select('id,label,status')
      .eq('organization_id', id)
      .order('created_at')
      .limit(500),
    db
      .from('source_preferences')
      .select('id,name,access_status,notes')
      .eq('organization_id', id)
      .limit(500),
    db.from('opportunities').select(opportunityFields).eq('organization_id', id).limit(500),
    db.from('pursuits').select(pursuitFields).eq('organization_id', id).limit(500),
    db
      .from('company_documents')
      .select('id,title,document_type,scan_status')
      .eq('organization_id', id)
      .limit(500),
    db
      .from('organization_memberships')
      .select('id,user_id,role,status')
      .eq('organization_id', id)
      .limit(500),
    db
      .from('audit_events')
      .select('id,entity_table,action,created_at,actor_user_id')
      .eq('organization_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('pursuit_tasks').select(taskFields).eq('organization_id', id).limit(500),
  ]);
  if (results.some((r) => r.error))
    throw new Error(
      'Workspace data could not be loaded. Please retry or contact the administrator.',
    );
  const data = {
    reviewAsOf: new Date().toISOString(),
    organization: { ...results[0].data, role: choice.role },
    choices: account.choices,
    userEmail: account.user.email ?? '',
    userId: account.user.id,
    facts: results[1].data,
    onboarding: results[2].data,
    sources: results[3].data,
    opportunities: results[4].data,
    pursuits: results[5].data,
    documents: results[6].data,
    members: results[7].data,
    audit: results[8].data,
    tasks: results[9].data,
  } as TenantData;
  if (recordContext) {
    // Keep the existing workspace search sample while resolving detail records independently.
    const merge = <T extends { id: string }>(sample: T[], direct: T[]) => [
      ...new Map([...sample, ...direct].map((row) => [row.id, row])).values(),
    ];
    data.opportunities = merge(data.opportunities, recordContext.opportunities);
    data.pursuits = merge(data.pursuits, recordContext.pursuits);
    data.tasks = merge(data.tasks, recordContext.tasks);
  }
  return { account, data };
}
export async function requireAdmin(organizationId: string) {
  if (!z.uuid().safeParse(organizationId).success) throw new Error('Invalid organization.');
  const account = await accountContext();
  if (
    !account.user ||
    !account.supabase ||
    !account.choices.some((c) => c.id === organizationId && c.role === 'organization_admin')
  )
    throw new Error('Organization administrator access required.');
  return { ...account, supabase: account.supabase, user: account.user };
}
