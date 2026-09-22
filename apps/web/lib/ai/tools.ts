import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { AiError, FEED_NOTICE, LIMITS, type Evidence, type Role } from './contracts';
import {
  discloseFact,
  displayDate,
  effectiveStatus,
  publicFactTypes,
  sourceFreshness,
} from './policy';
const empty = z.object({}).strict();
const record = z.object({ id: z.uuid() }).strict();
export const toolSchemas = {
  get_workspace_summary: empty,
  search_opportunities: z.object({ query: z.string().max(100), added_today: z.boolean() }).strict(),
  get_opportunity: record,
  get_opportunity_requirements: record,
  get_upcoming_deadlines: z.object({ days: z.number().int().min(1).max(90) }).strict(),
  get_company_readiness: empty,
  get_authorized_company_facts: empty,
  search_company_records: z
    .object({
      query: z
        .string()
        .max(100)
        .describe(
          'Search the record label, for example insurance or business email. Empty for all labels.',
        ),
      fact_type: z
        .string()
        .max(50)
        .nullable()
        .describe(
          'Exact category, such as identity, insurance or license; null for all authorized categories.',
        ),
      offset: z
        .number()
        .int()
        .min(0)
        .max(10000)
        .describe('Start at zero; use nextOffset to read another bounded page.'),
    })
    .strict(),
  get_pursuit: record,
  get_pursuit_releases: record,
  get_response_release: record,
  get_pursuit_tasks: z.object({ id: z.uuid().nullable(), overdue_only: z.boolean() }).strict(),
  compare_opportunities: z.object({ ids: z.array(z.uuid()).min(2).max(2) }).strict(),
  get_recent_record_changes: record,
  create_bid_no_bid_briefing: record,
};
export const functionTools = Object.entries(toolSchemas).map(([name, schema]) => ({
  type: 'function' as const,
  name,
  description: `Read authorized ${name.replaceAll('_', ' ')}. IDs must be available in the selected workspace. Returns bounded records and source keys; never writes.`,
  strict: true,
  parameters: z.toJSONSchema(schema),
}));
type Row = Record<string, unknown> & { id: string };
const opportunityFields =
  'id,title,solicitation_number,buyer,official_deadline,deadline_timezone,status,created_at,updated_at';
const factFields =
  'id,fact_type,label,value,sensitivity,verification_status,effective_date,expiration_date,verified_at,verified_by,last_checked:structured_fields->>last_checked,created_at,updated_at';
export class EvidenceTools {
  readonly evidence = new Map<string, Evidence>();
  private remaining = LIMITS.records;
  constructor(
    private db: SupabaseClient,
    readonly org: string,
    readonly role: Role,
    private now = new Date(),
  ) {}
  private query(table: string, fields: string) {
    return this.db.from(table).select(fields).eq('organization_id', this.org);
  }
  private async rows(query: PromiseLike<{ data: unknown; error: unknown }>) {
    const { data, error } = await query;
    if (error) throw new AiError('service_unavailable', 503);
    const rows = (data ?? []) as Row[];
    if (rows.length > this.remaining) throw new AiError('tool_limit', 429);
    this.remaining -= rows.length;
    return rows;
  }
  private add(
    type: string,
    r: Row,
    fields: Record<string, unknown>,
    status = 'unverified',
    parent?: string,
  ) {
    const key = `${type}:${r.id}`;
    const paths: Record<string, string> = {
      opportunity: '/opportunities/' + r.id,
      pursuit: '/pursuits/' + r.id,
      task: '/pursuits/' + parent,
      fact: '/company',
      requirement: '/pursuits/' + parent,
      audit: '/assistant',
      release: '/pursuits/' + parent,
    };
    const href =
      type === 'workspace'
        ? `/assistant?organization=${this.org}`
        : `/assistant/sources/${type}/${r.id}?organization=${this.org}`;
    const bounded = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.slice(0, 1000) : value,
      ]),
    );
    const item: Evidence = {
      citation: {
        key,
        type,
        title: String(r.title ?? r.label ?? type).slice(0, 200),
        id: r.id,
        sourceDate: typeof r.created_at === 'string' ? r.created_at : null,
        updatedAt: typeof r.updated_at === 'string' ? r.updated_at : null,
        status,
        href,
      },
      fields: {
        ...bounded,
        ...(paths[type] ? { workspaceRoute: paths[type] + `?organization=${this.org}` } : {}),
      },
    };
    this.evidence.set(key, item);
    return item;
  }
  private opportunity(r: Row) {
    return this.add('opportunity', r, {
      title: r.title,
      solicitationNumber: r.solicitation_number,
      buyer: r.buyer,
      entryMethod: 'manual',
      addedToBidXchange: r.created_at,
      lastUpdated: r.updated_at,
      officialPublicationDate: null,
      lastSourceSync: null,
      deadline: displayDate(r.official_deadline, r.deadline_timezone),
      deadlinePassed:
        typeof r.official_deadline === 'string'
          ? Date.parse(r.official_deadline) < this.now.getTime()
          : null,
      status: r.status,
      verification: 'unverified',
      eligibility: 'not_evaluated',
      fitScore: null,
      stale:
        typeof r.updated_at === 'string'
          ? this.now.getTime() - Date.parse(r.updated_at) > 30 * 86400000
          : true,
    });
  }
  async opportunityById(id: string) {
    const rows = await this.rows(
      this.query('opportunities', opportunityFields).eq('id', id).limit(1),
    );
    if (!rows[0]) throw new AiError('forbidden', 403);
    return this.opportunity(rows[0]);
  }
  private async facts(search?: { query: string; fact_type: string | null; offset: number }) {
    let query = this.query('profile_facts', factFields).neq('sensitivity', 'unknown');
    if (!['organization_admin', 'executive_approver', 'estimator'].includes(this.role))
      query = query.eq('sensitivity', 'workspace').in('fact_type', publicFactTypes);
    if (search?.query) query = query.ilike('label', `%${search.query.replace(/[%_\\]/g, '')}%`);
    if (search?.fact_type) query = query.eq('fact_type', search.fact_type);
    const size = Math.min(10, this.remaining);
    const offset = search?.offset ?? 0;
    const rows = await this.rows(query.order('id').range(offset, offset + size - 1));
    return rows
      .filter((r) => discloseFact(this.role, r.sensitivity, r.fact_type))
      .map((r) =>
        this.add(
          'fact',
          r,
          {
            type: r.fact_type,
            label: r.label,
            value: typeof r.value === 'string' ? r.value.slice(0, 1000) : null,
            status: effectiveStatus(r, this.now),
            sourceFreshness: sourceFreshness(r, this.now),
            expiration: r.expiration_date,
            effectiveDate: r.effective_date,
            lastUpdated: r.updated_at,
          },
          effectiveStatus(r, this.now),
        ),
      );
  }
  private async release(id: string) {
    if (this.remaining < 6) throw new AiError('tool_limit', 429);
    const r = (
      await this.rows(
        this.query('response_release_versions', 'id,pursuit_id,sequence,created_at')
          .eq('id', id)
          .limit(1),
      )
    )[0];
    if (!r) throw new AiError('forbidden', 403);
    const gates = ['pricing', 'compliance', 'final', 'submission'] as const;
    const [statusResult, submissionRows, ...approvalRows] = await Promise.all([
      this.db.rpc('response_release_status', { org: this.org, release: id }),
      this.rows(
        this.query(
          'response_submission_history',
          'id,kind,submitted_at,recorded_at,submitted_by,recorded_by,previous_id',
        )
          .eq('release_id', id)
          .order('sequence', { ascending: false })
          .limit(1),
      ),
      ...gates.map((gate) =>
        this.rows(
          this.query('response_approval_history', 'id,approval_type,decision,approver,decided_at')
            .eq('release_id', id)
            .eq('approval_type', gate)
            .order('sequence', { ascending: false })
            .limit(1),
        ),
      ),
    ]);
    const parsed = z
      .object({
        current: z.boolean(),
        approvals: z.object({
          pricing: z.boolean(),
          compliance: z.boolean(),
          final: z.boolean(),
          submission: z.boolean(),
        }),
        approval_ids: z.record(z.string(), z.string()),
        submission_id: z.string().nullable(),
      })
      .safeParse(statusResult.data);
    if (statusResult.error || !parsed.success) throw new AiError('service_unavailable', 503);
    const status = parsed.data;
    const submission = submissionRows[0];
    if ((submission?.id ?? null) !== status.submission_id)
      throw new AiError('service_unavailable', 503);
    const fields: Record<string, unknown> = {
      releaseSequence: r.sequence,
      releaseCurrent: status.current,
      reviewedAt: this.now.toISOString(),
      approvalScope:
        'Human approvals apply only to this release. Historical approval does not authorize an edited or stale draft. Conditions and rationale are not included; review them in the workspace.',
      submission: submission ? 'user_recorded' : 'no_record_for_this_release',
      submissionNotice:
        'Submission information was recorded by a user and was not independently verified by BidXchange. This does not establish buyer receipt. Other releases and legacy submission records are not included.',
    };
    for (const [index, gate] of gates.entries()) {
      const latest = approvalRows[index][0];
      if (status.approvals[gate] && status.approval_ids[gate] !== latest?.id)
        throw new AiError('service_unavailable', 503);
      fields[gate + 'ApprovalCurrent'] = status.current && status.approvals[gate];
      fields[gate + 'LastDecision'] = latest?.decision ?? 'not_recorded';
      fields[gate + 'ApprovalRecord'] = latest?.id ?? null;
      fields[gate + 'Approver'] = latest?.approver ?? null;
      fields[gate + 'DecidedAt'] = latest?.decided_at ?? null;
    }
    if (submission)
      Object.assign(fields, {
        submissionRecord: submission.id,
        submissionKind: submission.kind,
        submittedAt: submission.submitted_at,
        recordedAt: submission.recorded_at,
        submittedBy: submission.submitted_by,
        recordedBy: submission.recorded_by,
        previousSubmissionRecord: submission.previous_id,
      });
    return this.add(
      'release',
      { ...r, title: `Response release ${r.sequence}` },
      fields,
      status.current
        ? 'current release; human review required'
        : 'stale release; historical records only',
      String(r.pursuit_id),
    );
  }
  async run(name: string, args: unknown): Promise<unknown> {
    const schema = toolSchemas[name as keyof typeof toolSchemas];
    if (!schema) throw new AiError('invalid_tool');
    const parsed = schema.safeParse(args);
    if (!parsed.success) throw new AiError('invalid_tool');
    const a = parsed.data as {
      id?: string;
      ids?: string[];
      query?: string;
      days?: number;
      added_today?: boolean;
      overdue_only?: boolean;
      fact_type?: string | null;
      offset?: number;
    };
    if (this.remaining <= 0) throw new AiError('tool_limit', 429);
    switch (name) {
      case 'get_workspace_summary':
        return this.add(
          'workspace',
          { id: this.org, title: 'Workspace evidence boundary' },
          {
            liveFeeds: false,
            notice: FEED_NOTICE,
            asOf: this.now.toISOString(),
            scope:
              'Only returned authorized structured records; lists are bounded, not total counts.',
            eligibility: 'not_evaluated',
            fitScore: null,
            documents: 'excluded',
            sourceNotes: 'excluded',
          },
          'application configuration',
        );
      case 'get_opportunity':
        return this.opportunityById(a.id!);
      case 'compare_opportunities':
        return Promise.all(a.ids!.map((id) => this.opportunityById(id)));
      case 'search_opportunities': {
        let q = this.query('opportunities', opportunityFields);
        if (a.query) q = q.ilike('title', `%${a.query.replace(/[%_\\]/g, '')}%`);
        if (a.added_today)
          q = q
            .gte('created_at', this.now.toISOString().slice(0, 10) + 'T00:00:00Z')
            .lt(
              'created_at',
              new Date(Date.parse(this.now.toISOString().slice(0, 10)) + 86400000).toISOString(),
            );
        return (
          await this.rows(
            q
              .order('created_at', { ascending: false })
              .order('id')
              .limit(Math.min(10, this.remaining)),
          )
        ).map((r) => this.opportunity(r));
      }
      case 'get_upcoming_deadlines':
        return (
          await this.rows(
            this.query('opportunities', opportunityFields)
              .gte('official_deadline', this.now.toISOString())
              .lte(
                'official_deadline',
                new Date(this.now.getTime() + a.days! * 86400000).toISOString(),
              )
              .order('official_deadline')
              .order('id')
              .limit(Math.min(10, this.remaining)),
          )
        ).map((r) => this.opportunity(r));
      case 'get_company_readiness':
      case 'get_authorized_company_facts':
        return this.facts();
      case 'search_company_records': {
        const size = Math.min(10, this.remaining);
        const records = await this.facts({
          query: a.query!,
          fact_type: a.fact_type!,
          offset: a.offset!,
        });
        return {
          records,
          readAt: this.now.toISOString(),
          nextOffset: records.length === size ? a.offset! + size : null,
          scope:
            'Authorized saved company records only. A full page may have another page; it is not a company-wide total. Unsaved edits, unknown sensitivity and source notes are excluded.',
        };
      }
      case 'get_pursuit': {
        const r = (
          await this.rows(
            this.query('pursuits', 'id,title,opportunity_id,decision,status,created_at,updated_at')
              .eq('id', a.id!)
              .limit(1),
          )
        )[0];
        if (!r) throw new AiError('forbidden', 403);
        const history = (
          await this.rows(
            this.query('pursuit_decision_history', 'id,decision,context_token,decided_at')
              .eq('pursuit_id', a.id!)
              .order('decided_at', { ascending: false })
              .limit(1),
          )
        )[0];
        let decisionReview = 'no_recorded_review';
        if (history) {
          const context = await this.db.rpc('pursuit_decision_context', {
            org: this.org,
            pursuit: a.id!,
          });
          if (context.error || typeof context.data !== 'string')
            throw new AiError('service_unavailable', 503);
          decisionReview =
            history.context_token === context.data && history.decision === r.decision
              ? 'current_recorded_review'
              : 'stale_requires_human_reaffirmation';
        }
        return this.add(
          'pursuit',
          r,
          {
            title: r.title,
            opportunityId: r.opportunity_id,
            recordedDecision: r.decision,
            decisionReview,
            decisionRecordedAt: history?.decided_at ?? null,
            status: r.status,
            submission: 'not_checked',
            submissionNotice:
              'Use get_pursuit_releases and get_response_release to read version-bound approval and user-recorded submission history. Absence here does not mean no submission occurred.',
          },
          'pending human review',
        );
      }
      case 'get_pursuit_releases': {
        const pursuit = (await this.rows(this.query('pursuits', 'id').eq('id', a.id!).limit(1)))[0];
        if (!pursuit) throw new AiError('forbidden', 403);
        const releases = await this.rows(
          this.query('response_release_versions', 'id,pursuit_id,sequence,created_at')
            .eq('pursuit_id', a.id!)
            .order('sequence', { ascending: false })
            .limit(Math.min(10, this.remaining)),
        );
        return {
          records: releases.map((r) =>
            this.add(
              'release',
              { ...r, title: `Response release ${r.sequence}` },
              {
                releaseSequence: r.sequence,
                createdAt: r.created_at,
                approvalReview: 'not_checked',
                submission: 'not_checked',
              },
              'release metadata only',
              String(r.pursuit_id),
            ),
          ),
          scope:
            'Up to 10 most recent releases, newest first. Use get_response_release for each relevant release. Older releases and legacy submission records are not included; no result is not proof that a bid was never submitted.',
        };
      }
      case 'get_response_release':
        return this.release(a.id!);
      case 'get_pursuit_tasks': {
        if (a.id) await this.run('get_pursuit', { id: a.id });
        let q = this.query(
          'pursuit_tasks',
          'id,title,pursuit_id,status,due_at,due_timezone,created_at,updated_at',
        );
        if (a.id) q = q.eq('pursuit_id', a.id);
        if (a.overdue_only) q = q.lt('due_at', this.now.toISOString()).neq('status', 'complete');
        return (
          await this.rows(
            q
              .order('due_at', { nullsFirst: false })
              .order('id')
              .limit(Math.min(10, this.remaining)),
          )
        ).map((r) =>
          this.add(
            'task',
            r,
            {
              title: r.title,
              status: r.status,
              deadline: displayDate(r.due_at, r.due_timezone),
              overdue:
                r.status !== 'complete' &&
                typeof r.due_at === 'string' &&
                Date.parse(r.due_at) < this.now.getTime(),
            },
            'recorded task',
            String(r.pursuit_id),
          ),
        );
      }
      case 'get_opportunity_requirements': {
        await this.opportunityById(a.id!);
        const pursuits = await this.rows(
          this.query('pursuits', 'id').eq('opportunity_id', a.id!).order('id').limit(5),
        );
        if (!pursuits.length) return [];
        // Free-text requirements/citations can contain confidential source notes. Exclude text in v1.
        return (
          await this.rows(
            this.query('pursuit_requirements', 'id,pursuit_id,status,created_at,updated_at')
              .in(
                'pursuit_id',
                pursuits.map((r) => r.id),
              )
              .order('id')
              .limit(Math.min(10, this.remaining)),
          )
        ).map((r) =>
          this.add(
            'requirement',
            { ...r, title: 'Recorded requirement' },
            { status: r.status, text: 'Excluded pending reviewed disclosure classification.' },
            'needs human review',
            String(r.pursuit_id),
          ),
        );
      }
      case 'get_recent_record_changes': {
        await this.opportunityById(a.id!);
        if (!['organization_admin', 'executive_approver'].includes(this.role))
          return { unavailable: 'Your role cannot read audit records.' };
        return (
          await this.rows(
            this.query('audit_events', 'id,entity_id,action,created_at')
              .eq('entity_table', 'opportunities')
              .eq('entity_id', a.id!)
              .order('created_at', { ascending: false })
              .order('id')
              .limit(Math.min(5, this.remaining)),
          )
        ).map((r) =>
          this.add(
            'audit',
            { ...r, title: 'Opportunity record change' },
            {
              action: r.action,
              at: r.created_at,
              details: 'Change payloads excluded. No addendum synchronization exists.',
            },
            'audit metadata',
          ),
        );
      }
      case 'create_bid_no_bid_briefing':
        return {
          opportunity: await this.opportunityById(a.id!),
          facts: await this.facts(),
          decision:
            'Human review required; eligibility and fit are not evaluated. No bid decision or pricing was changed.',
        };
      default:
        throw new AiError('invalid_tool');
    }
  }
  async source(kind: string, id: string): Promise<Evidence> {
    if (kind === 'release') await this.release(id);
    else if (kind === 'opportunity') await this.opportunityById(id);
    else if (kind === 'pursuit') await this.run('get_pursuit', { id });
    else if (kind === 'fact') {
      const r = (await this.rows(this.query('profile_facts', factFields).eq('id', id).limit(1)))[0];
      if (!r || !discloseFact(this.role, r.sensitivity, r.fact_type))
        throw new AiError('forbidden', 403);
      this.add(
        'fact',
        r,
        {
          label: r.label,
          value: r.value,
          type: r.fact_type,
          lastUpdated: r.updated_at,
          effectiveDate: r.effective_date,
          status: effectiveStatus(r, this.now),
          sourceFreshness: sourceFreshness(r, this.now),
          expiration: r.expiration_date,
        },
        effectiveStatus(r, this.now),
      );
    } else if (kind === 'task') {
      const r = (
        await this.rows(
          this.query(
            'pursuit_tasks',
            'id,title,pursuit_id,status,due_at,due_timezone,created_at,updated_at',
          )
            .eq('id', id)
            .limit(1),
        )
      )[0];
      if (!r) throw new AiError('forbidden', 403);
      this.add(
        kind,
        r,
        { title: r.title, status: r.status, deadline: displayDate(r.due_at, r.due_timezone) },
        'recorded task',
        String(r.pursuit_id),
      );
    } else if (kind === 'requirement') {
      const r = (
        await this.rows(
          this.query('pursuit_requirements', 'id,pursuit_id,status,created_at,updated_at')
            .eq('id', id)
            .limit(1),
        )
      )[0];
      if (!r) throw new AiError('forbidden', 403);
      this.add(
        kind,
        { ...r, title: 'Recorded requirement' },
        { status: r.status, text: 'Excluded pending reviewed disclosure classification.' },
        'needs human review',
        String(r.pursuit_id),
      );
    } else if (
      kind === 'audit' &&
      ['organization_admin', 'executive_approver'].includes(this.role)
    ) {
      const r = (
        await this.rows(
          this.query('audit_events', 'id,entity_id,action,created_at')
            .eq('id', id)
            .eq('entity_table', 'opportunities')
            .limit(1),
        )
      )[0];
      if (!r) throw new AiError('forbidden', 403);
      await this.opportunityById(String(r.entity_id));
      this.add(
        kind,
        { ...r, title: 'Opportunity record change' },
        { action: r.action, at: r.created_at },
        'audit metadata',
      );
    }
    const result = this.evidence.get(`${kind}:${id}`);
    if (!result) throw new AiError('forbidden', 403);
    return result;
  }
}
