import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AiError, errorMessages, type Role } from '../ai/contracts';
import { readJsonBody } from '../ai/read-body';
import { SourceError } from '../sources/sam';
import { samRequest, validateSamFilters } from './sam-contracts';
import { prepareSamFilters, readSamCompany, searchSam } from './sam-search';
import type { ResearchPlan } from './contracts';

type Account = { db: SupabaseClient; user: { id: string }; role: Role };
type Config = { key: string; orgLimit: number; userLimit: number };
export type SamDependencies = {
  authorize: (org: string) => Promise<Account>;
  sameOrigin: (request: Request) => void;
  config: () => Config | null;
  samKey: () => string | null;
  plan: (prompt: string, now: string, signal: AbortSignal) => Promise<ResearchPlan>;
  search?: typeof searchSam;
};
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export function samHandlers(deps: SamDependencies) {
  async function active(org: string) {
    const account = await deps.authorize(org);
    const setting = await account.db
      .from('ai_organization_settings')
      .select('enabled')
      .eq('organization_id', org)
      .maybeSingle();
    if (!deps.config() || setting.error || setting.data?.enabled !== true)
      throw new AiError('unavailable', 503);
    return account;
  }
  function failure(error: unknown) {
    if (error instanceof SourceError) {
      const messages: Record<string, string> = {
        rate_limited: 'SAM.gov reached its request limit. No automatic retry was made. Try later.',
        invalid_key: 'SAM.gov rejected the configured connection. An administrator must check it.',
        timeout: 'SAM.gov did not respond in time. No results were returned; try later.',
        cancelled: 'Search cancelled.',
      };
      return Response.json(
        {
          message:
            messages[error.code] ??
            'SAM.gov returned an unavailable or unreadable response. No results were accepted.',
        },
        { status: error.code === 'rate_limited' ? 429 : 503, headers },
      );
    }
    const e = error instanceof AiError ? error : new AiError('service_unavailable', 503);
    return Response.json(
      { message: errorMessages[e.code] ?? errorMessages.service_unavailable },
      { status: e.status, headers },
    );
  }
  return {
    async GET(request: Request) {
      try {
        const org = new URL(request.url).searchParams.get('organization') ?? '';
        const account = await active(org);
        const company = await readSamCompany(
          account.db,
          org,
          account.role,
          new Date().toISOString(),
        );
        const final = await active(org);
        if (account.user.id !== final.user.id || account.role !== final.role)
          throw new AiError('forbidden', 403);
        return Response.json({ available: !!deps.samKey(), company }, { headers });
      } catch (error) {
        return failure(error);
      }
    },
    async POST(request: Request) {
      try {
        deps.sameOrigin(request);
        const parsed = samRequest.safeParse(await readJsonBody(request, 12000));
        if (!parsed.success) throw new AiError('invalid_request');
        const body = parsed.data;
        if (body.action === 'search') {
          try {
            validateSamFilters(body.filters);
          } catch {
            throw new AiError('invalid_request');
          }
        }
        const account = await active(body.organizationId);
        const config = deps.config()!;
        const key = deps.samKey();
        if (body.action === 'search' && !key)
          return Response.json(
            {
              message:
                'Live SAM.gov search is not configured. Your filters are ready; an administrator must configure the official connection first.',
            },
            { status: 503, headers },
          );
        const digest = (value: unknown) =>
          createHmac('sha256', config.key).update(JSON.stringify(value)).digest('hex');
        const reserved = await account.db.rpc('reserve_ai_request', {
          org: body.organizationId,
          request_id: body.requestId,
          digest: digest(['sam-research', account.user.id, body]),
          org_limit: Math.min(config.orgLimit, 100),
          user_limit: Math.min(config.userLimit, 20),
        });
        if (reserved.error) throw new AiError('unavailable', 503);
        if (reserved.data !== 'reserved')
          throw new AiError(String(reserved.data), reserved.data === 'forbidden' ? 403 : 429);
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(40000)]);
        const current = await active(body.organizationId);
        if (current.user.id !== account.user.id || current.role !== account.role)
          throw new AiError('forbidden', 403);
        let payload;
        if (body.action === 'prepare') {
          // The model receives only the user's question, never company evidence.
          const plan = await deps.plan(body.prompt, new Date().toISOString(), signal);
          const prepared = prepareSamFilters(plan, new Date());
          payload = { prepared, available: !!deps.samKey() };
        } else {
          // The provider receives exactly the reviewed public filters, not the conversation or facts.
          const report = await (deps.search ?? searchSam)(body.filters, key!, [], signal);
          payload = { report };
        }
        const final = await active(body.organizationId);
        if (final.user.id !== account.user.id || final.role !== account.role)
          throw new AiError('forbidden', 403);
        if (signal.aborted) throw new AiError('cancelled', 499);
        const company = await readSamCompany(
          final.db,
          body.organizationId,
          final.role,
          new Date().toISOString(),
        );
        if ('report' in payload && payload.report) {
          payload.report.results.forEach((r) => {
            r.companyEvidence = company.codes.filter((c) => c.code === r.naics);
          });
          payload.report.canSave = ['organization_admin', 'capture_manager'].includes(final.role);
          if (company.partial)
            payload.report.warnings.push(
              'Company comparison uses only the newest 100 visible procurement-code/service records.',
            );
        }
        const afterFacts = await active(body.organizationId);
        if (
          afterFacts.user.id !== final.user.id ||
          afterFacts.role !== final.role ||
          signal.aborted
        )
          throw new AiError('forbidden', 403);
        const report = 'report' in payload ? payload.report : undefined;
        const audit = await afterFacts.db.from('research_run_audit').insert({
          id: body.requestId,
          organization_id: body.organizationId,
          user_id: final.user.id,
          filter_digest: digest([
            body.action,
            body.action === 'search' ? body.filters : payload,
            report?.results.map((r) => r.id),
          ]),
          sources: report ? ['sam.gov'] : [],
          reviewed: report?.returned ?? 0,
          returned: report?.returned ?? 0,
          partial: report?.partial ?? false,
          // This column references workspace UUIDs; external SAM notice IDs are not workspace rows.
          result_ids: [],
        });
        if (audit.error) throw new AiError('service_unavailable', 503);
        if (signal.aborted) throw new AiError('cancelled', 499);
        return Response.json({ ...payload, company }, { headers });
      } catch (error) {
        return failure(error);
      }
    },
  };
}
