import type { SupabaseClient } from '@supabase/supabase-js';
import { AiError, type Role } from '../ai/contracts';
import { discloseFact } from '../ai/policy';
import type { Fact } from '../tenant-types';
import { readNormalized } from '../sources/normalized';
import { reviewedPortalUrl } from '../sources/portal-url';
import type { ResearchNotice, ResearchPlan, ResearchReport } from './contracts';
import { evaluateResearch } from './evaluate';

export async function retrieveResearch(
  db: SupabaseClient,
  org: string,
  role: Role,
  plan: ResearchPlan,
  now: string,
  sourcesEnabled: boolean,
): Promise<ResearchReport> {
  const factsQuery = db
    .from('profile_facts')
    .select(
      'id,fact_type,label,value,sensitivity,verification_status,source_reference,source_note,verified_by,verified_at,effective_date,expiration_date,updated_at,structured_kind,structured_fields',
    )
    .eq('organization_id', org)
    .order('id')
    .limit(201);
  const recordsQuery = db
    .from('opportunities')
    .select('id,title,buyer,status,source_url,official_deadline,source_details,updated_at')
    .eq('organization_id', org)
    .order('updated_at', { ascending: false })
    .order('id')
    .limit(201);
  const [facts, records] = await Promise.all([factsQuery, recordsQuery]);
  if (facts.error || records.error) throw new AiError('service_unavailable', 503);
  const visible = (facts.data as Fact[])
    .slice(0, 200)
    .filter((f) => discloseFact(role, f.sensitivity, f.fact_type));
  const notices: ResearchNotice[] = (records.data ?? []).slice(0, 200).map((r) => {
    const d = readNormalized(r.source_details);
    return {
      id: r.id,
      source: 'workspace',
      title: r.title,
      agency: r.buyer,
      naics: d?.naics ?? null,
      psc: d?.psc ?? null,
      state: null,
      setAside: d?.preference ?? null,
      noticeType: d?.opportunityType ?? null,
      published: d?.publishedAt || null,
      deadline: r.official_deadline,
      status: r.status,
      sourceUrl: reviewedPortalUrl(r.source_url),
      synchronizedAt: null,
      version: r.updated_at,
      changedFields: [],
      workspaceUrl: `/opportunities/${r.id}?organization=${org}`,
      attachments: null,
      blockers: [],
    };
  });
  const sources: ResearchReport['sources'] = [
    { id: 'workspace', status: 'Saved records; not a live portal search', lastSuccess: null },
  ];
  const warnings = [
    'Attachments have not been downloaded or analyzed. Requirement findings, profit, distance and partner suitability are not established.',
    'Results are ranked by visible code overlap and explicit search-filter matches, not win probability or qualification. Missing filter fields are flagged, not assumed to match.',
  ];
  let partial = (facts.data?.length ?? 0) > 200 || (records.data?.length ?? 0) > 200;
  if (sourcesEnabled && plan.source !== 'workspace' && plan.intent !== 'grants') {
    const [status, inbox] = await Promise.all([
      db.rpc('source_connection_status', { org }),
      db
        .from('source_inbox')
        .select('id,record_id,change_pending')
        .eq('organization_id', org)
        .order('created_at', { ascending: false })
        .order('id')
        .limit(201),
    ]);
    if (status.error || inbox.error) throw new AiError('service_unavailable', 503);
    const connection = status.data?.[0];
    sources.push({
      id: 'sam.gov',
      status: connection?.enabled
        ? `Synchronized inbox; ${connection.last_status}`
        : 'Sync disabled; cached inbox only',
      lastSuccess: connection?.last_success ?? null,
    });
    partial ||= inbox.data.length > 200;
    const ids = [...new Set(inbox.data.slice(0, 200).map((r) => r.record_id))];
    if (ids.length) {
      // Source RLS grants visibility through this organization's inbox. Never query global source history unscoped.
      const rows = await db
        .from('source_records')
        .select('id,source_id,current_version_id,last_seen,first_seen')
        .in('id', ids)
        .limit(200);
      if (rows.error) throw new AiError('service_unavailable', 503);
      const versions = await db
        .from('source_record_versions')
        .select('id,record_id,normalized,changed_fields,captured_at')
        .in(
          'id',
          rows.data.map((r) => r.current_version_id),
        )
        .limit(200);
      if (versions.error) throw new AiError('service_unavailable', 503);
      for (const record of rows.data) {
        const v = versions.data.find(
          (v) => v.id === record.current_version_id && v.record_id === record.id,
        );
        if (!v?.normalized || typeof v.normalized !== 'object') {
          warnings.push('A cached source record could not be read.');
          continue;
        }
        const n = v.normalized as Record<string, unknown>;
        const string = (key: string) =>
          typeof n[key] === 'string' ? (n[key] as string).slice(0, 2000) : null;
        const place = n.place as { state?: { code?: string } } | null;
        notices.push({
          id: record.id,
          source: record.source_id,
          title: string('title') ?? 'Untitled notice',
          agency:
            [string('department'), string('subtier'), string('office')]
              .filter(Boolean)
              .join(' / ') || null,
          naics: string('naics'),
          psc: string('classification'),
          state: typeof place?.state?.code === 'string' ? place.state.code : null,
          setAside: string('setAside'),
          noticeType: string('noticeType'),
          published: string('published'),
          deadline: string('deadlineInstant'),
          status: string('status') ?? 'unknown',
          sourceUrl: reviewedPortalUrl(string('sourceUrl')),
          synchronizedAt: record.last_seen,
          version: v.id,
          changedFields: inbox.data.find((i) => i.record_id === record.id)?.change_pending
            ? v.changed_fields
            : [],
          workspaceUrl: `/opportunities/sources?organization=${org}`,
          attachments: Array.isArray(n.resources) ? n.resources.length : null,
          blockers: [],
        });
      }
    }
  } else if (plan.source !== 'workspace')
    warnings.push(
      'SAM.gov is not connected in this environment. No live SAM.gov request was made.',
    );
  if (plan.intent === 'grants')
    warnings.push(
      'Grant discovery is unavailable. Contract notices have not been substituted for grant results.',
    );
  if (plan.radiusMiles)
    warnings.push(
      `The requested ${plan.radiusMiles}-mile radius could not be evaluated. No geocoding or distance calculation was performed.`,
    );
  if (plan.intent === 'profitability')
    warnings.push(
      'Profitability cannot be ranked without reviewed pricing, cost, effort and capacity data.',
    );
  if (plan.status === 'archived')
    warnings.push(
      'This cache is not a complete archive. Inactive SAM notices are not automatically classified as archived.',
    );
  const localIds = notices.filter((n) => n.source === 'workspace').map((n) => n.id);
  if (localIds.length) {
    const pursuits = await db
      .from('pursuits')
      .select('id,opportunity_id')
      .eq('organization_id', org)
      .in('opportunity_id', localIds)
      .limit(201);
    if (pursuits.error) throw new AiError('service_unavailable', 503);
    partial ||= pursuits.data.length > 200;
    const ids = pursuits.data.slice(0, 200).map((p) => p.id);
    if (ids.length) {
      const blocked = await db
          .from('pursuit_requirements')
          .select('id,pursuit_id,requirement,status')
          .is('archived_at', null)
        .eq('organization_id', org)
        .in('pursuit_id', ids)
        .limit(201);
      if (blocked.error) throw new AiError('service_unavailable', 503);
      partial ||= blocked.data.length > 200;
      const findings =
        process.env.BIDXCHANGE_RESOLUTIONS_ENABLED === 'true'
          ? await db
              .from('current_requirement_resolutions')
              .select('requirement_id,disposition,review_current')
              .eq('organization_id', org)
              .in('pursuit_id', ids)
              .limit(201)
          : { data: [], error: null };
      if (findings.error) throw new AiError('service_unavailable', 503);
      partial ||= (findings.data?.length ?? 0) > 200;
      for (const b of blocked.data.slice(0, 200)) {
        const finding = findings.data?.find((f) => f.requirement_id === b.id);
        if (finding?.review_current ? finding.disposition !== 'blocked' : b.status !== 'blocked')
          continue;
        const p = pursuits.data.find((p) => p.id === b.pursuit_id);
        notices
          .find((n) => n.source === 'workspace' && n.id === p?.opportunity_id)
          ?.blockers.push({
            requirement: b.requirement,
            href: `/pursuits/${b.pursuit_id}?organization=${org}#requirement-${b.id}`,
          });
      }
    }
  }
  const eligible =
    plan.intent === 'grants'
      ? []
      : notices.filter((n) => plan.source === 'all' || n.source === plan.source);
  const evaluated = evaluateResearch(eligible, visible, plan, now);
  return {
    plan,
    checkedAt: now,
    reviewed: eligible.length,
    sources:
      plan.intent === 'grants'
        ? []
        : sources.filter((s) => plan.source === 'all' || s.id === plan.source),
    partial,
    warnings: [...new Set(warnings)],
    ...evaluated,
  };
}
