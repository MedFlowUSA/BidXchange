import 'server-only';
import { z } from 'zod';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServer } from './supabase/server';
import type { OrganizationChoice } from './routes';
import type { TenantData } from './tenant-types';
import { loadEvidenceMonitoring } from './evidence-monitor-records';
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
        process.env.BIDXCHANGE_STRUCTURED_PROFILES_ENABLED === 'true'
          ? 'id,fact_type,label,value,verification_status,source_reference,source_note,verified_by,verified_at,effective_date,expiration_date,updated_at,owner_user_id,sensitivity,structured_kind,structured_fields'
          : 'id,fact_type,label,value,verification_status,source_reference,source_note,verified_by,verified_at,effective_date,expiration_date,updated_at,owner_user_id,sensitivity',
      )
      .eq('organization_id', id)
      .order('created_at')
      .limit(500)
      .overrideTypes<TenantData['facts'], { merge: false }>(),
    db
      .from('onboarding_items')
      .select(
        'id,label,status,notes,updated_at,assigned_user_id,due_on,passport_section,passport_item,requested_by,last_updated_by,completed_by,completed_at',
      )
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
    choice.role === 'organization_admin'
      ? db
          .from('audit_events')
          .select('id,entity_table,action,created_at,actor_user_id')
          .eq('organization_id', id)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    db
      .from('pursuit_tasks')
      .select(taskFields)
      .eq('organization_id', id)
      .limit(500)
      .overrideTypes<TenantData['tasks'], { merge: false }>(),
    /^\/company(\?|$)/.test(next)
      ? db
          .from('company_profiles')
          .select('id,summary,updated_at')
          .eq('organization_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (results.some((r) => r.error))
    throw new Error(
      'Workspace data could not be loaded. Please retry or contact the administrator.',
    );
  const data = {
    selfServiceEnabled: process.env.BIDXCHANGE_SELF_SERVICE_ENABLED === 'true',
    structuredProfilesEnabled: process.env.BIDXCHANGE_STRUCTURED_PROFILES_ENABLED === 'true',
    reviewAsOf: new Date().toISOString(),
    organization: { ...results[0].data, role: choice.role },
    choices: account.choices,
    userEmail: account.user.email ?? '',
    userId: account.user.id,
    facts: results[1].data,
    onboarding: results[2].data,
    contractorWorkflowEnabled: process.env.BIDXCHANGE_CONTRACTOR_WORKFLOW_ENABLED === 'true',
    sources: results[3].data,
    opportunities: results[4].data,
    pursuits: results[5].data,
    documents: results[6].data,
    members: results[7].data,
    audit: results[8].data,
    tasks: results[9].data,
    companyProfile: results[10].data,
  } as TenantData;
  if (choice.role === 'organization_admin' && /^\/(company|dashboard)(\?|$)/.test(next)) {
    const owners = await db.rpc('information_request_owners', { org: id });
    if (owners.error) throw new Error('Company request owners could not be loaded.');
    data.informationRequestOwners = owners.data ?? [];
  }
  if (
    process.env.BIDXCHANGE_EVIDENCE_MONITOR_ENABLED === 'true' &&
    /^\/(dashboard|company)(\?|$)/.test(next)
  ) {
    data.evidenceMonitoring = await loadEvidenceMonitoring(db, id);
  }
  if (recordContext) {
    // Keep the existing workspace search sample while resolving detail records independently.
    const merge = <T extends { id: string }>(sample: T[], direct: T[]) => [
      ...new Map([...sample, ...direct].map((row) => [row.id, row])).values(),
    ];
    data.opportunities = merge(data.opportunities, recordContext.opportunities);
    data.pursuits = merge(data.pursuits, recordContext.pursuits);
    data.tasks = merge(data.tasks, recordContext.tasks);
    data.requirements = recordContext.requirements ?? [];
    data.archivedRequirements = recordContext.archivedRequirements;
    data.requirementLifecycle = recordContext.requirementLifecycle;
    data.evidenceReviewsEnabled = recordContext.evidenceReviewsEnabled;
    data.evidenceReviews = recordContext.evidenceReviews;
    data.decisionsEnabled = recordContext.decisionsEnabled;
    data.decisionContext = recordContext.decisionContext;
    data.decisions = recordContext.decisions;
    data.resolutionsEnabled = recordContext.resolutionsEnabled;
    data.resolutions = recordContext.resolutions;
    data.resolutionHistory = recordContext.resolutionHistory;
    data.registerSignoffsEnabled = recordContext.registerSignoffsEnabled;
    data.registerSignoffs = recordContext.registerSignoffs;
    data.amendments = recordContext.amendments;
  }
  data.documentsEnabled = process.env.BIDXCHANGE_DOCUMENTS_ENABLED === 'true';
  data.releaseWorkflow = {
    enabled: process.env.BIDXCHANGE_RELEASES_ENABLED === 'true',
    versions: [],
    approvals: [],
    submissions: [],
    followups: [],
  };
  if (record?.kind === 'pursuit') {
    const packages = await db
      .from('proposal_sections')
      .select('id,title,content,status,updated_at')
      .eq('organization_id', id)
      .eq('pursuit_id', record.id)
      .or(
        'title.like.RFI response:%,title.like.RFP response:%,title.like.RFQ response:%,title.like.BID response:%,title.like.SOURCES_SOUGHT response:%,title.like.CAPABILITY response:%',
      )
      .order('updated_at', { ascending: false })
      .limit(21);
    if (packages.error) throw new Error('Response drafts could not be loaded. Please retry.');
    data.responsePackages = packages.data;
    if (data.releaseWorkflow.enabled) {
      const [versions, context] = await Promise.all([
        db
          .from('response_release_versions')
          .select('*')
          .eq('organization_id', id)
          .eq('pursuit_id', record.id)
          .order('sequence', { ascending: false })
          .limit(21),
        db.rpc('response_release_context', { org: id, pursuit: record.id }),
      ]);
      if (versions.error || context.error)
        throw new Error('Response release workflow unavailable. Retry.');
      const ids = versions.data.map((v) => v.id);
      data.releaseWorkflow.context = context.data;
      if (ids.length) {
        const [approvals, submissions, followups, statuses] = await Promise.all([
          db
            .from('response_approval_history')
            .select('*')
            .eq('organization_id', id)
            .in('release_id', ids)
            .order('sequence', { ascending: false })
            .limit(501),
          db
            .from('response_submission_history')
            .select('*')
            .eq('organization_id', id)
            .in('release_id', ids)
            .order('sequence', { ascending: false })
            .limit(501),
          db
            .from('response_followup_history')
            .select('*')
            .eq('organization_id', id)
            .in('release_id', ids)
            .order('sequence', { ascending: false })
            .limit(501),
          Promise.all(
            versions.data
              .slice(0, 20)
              .map((v) => db.rpc('response_release_status', { org: id, release: v.id })),
          ),
        ]);
        if (
          approvals.error ||
          submissions.error ||
          followups.error ||
          statuses.some((s) => s.error)
        )
          throw new Error('Approval history unavailable. Retry.');
        data.releaseWorkflow = {
          enabled: true,
          context: context.data,
          versions: versions.data.slice(0, 20).map((v, i) => ({ ...v, status: statuses[i].data })),
          approvals: approvals.data,
          submissions: submissions.data,
          followups: followups.data,
          partial:
            versions.data.length > 20 ||
            approvals.data.length > 500 ||
            submissions.data.length > 500 ||
            followups.data.length > 500,
        };
      }
    }
  }
  if (
    process.env.BIDXCHANGE_SOURCES_ENABLED === 'true' &&
    (next.startsWith('/opportunities') || next.startsWith('/dashboard'))
  ) {
    const chunks = Array.from({ length: Math.ceil(data.opportunities.length / 100) }, (_, index) =>
      data.opportunities.slice(index * 100, index * 100 + 100).map((o) => o.id),
    );
    const [attention, connection, links] = await Promise.all([
      db
        .from('source_inbox')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', id)
        .or('status.eq.new,status.eq.needs_review,change_pending.eq.true'),
      db.rpc('source_connection_status', { org: id }),
      Promise.all(
        chunks.map((ids) =>
          db
            .from('source_inbox')
            .select('opportunity_id,change_pending')
            .eq('organization_id', id)
            .in('opportunity_id', ids)
            .limit(100),
        ),
      ),
    ]);
    if (attention.error || connection.error || links.some((r) => r.error))
      throw new Error('Source status unavailable.');
    data.sourceAttention = attention.count ?? 0;
    const status = connection.data?.[0];
    data.sourceIssue =
      !status?.enabled ||
      status.last_status !== 'succeeded' ||
      !status.last_success ||
      Date.now() - Date.parse(status.last_success) > 36 * 3600000;
    data.sourceProvenance = links.flatMap((r) => r.data ?? []);
  }
  if (data.documentsEnabled && (next.startsWith('/documents') || record?.kind === 'pursuit')) {
    const [libraries, versions, links] = await Promise.all([
      db
        .from('document_libraries')
        .select('id,title')
        .eq('organization_id', id)
        .order('created_at', { ascending: false })
        .limit(501),
      db
        .from('document_versions')
        .select('id,document_id,version,sha256,byte_size,scan_status,created_at')
        .eq('organization_id', id)
        .order('created_at', { ascending: false })
        .limit(501),
      record?.kind === 'pursuit' && data.requirements?.length
        ? db
            .from('requirement_document_links')
            .select('id,requirement_id,document_version_id,source_reference')
            .eq('organization_id', id)
            .in(
              'requirement_id',
              data.requirements.map((r) => r.id),
            )
            .limit(501)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (libraries.error || versions.error || links.error)
      throw new Error('Document records unavailable. Retry.');
    data.documentLibraries = libraries.data ?? [];
    data.documentVersions = versions.data ?? [];
    data.documentLinks = links.data ?? [];
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
