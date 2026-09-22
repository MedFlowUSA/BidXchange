import OpenAI from 'openai';
import { createHmac } from 'node:crypto';
import { aiConfig } from '../../../../lib/ai/config';
import { AiError, errorMessages, LIMITS } from '../../../../lib/ai/contracts';
import { authorizeAi, requireSameOrigin } from '../../../../lib/ai/server';
import { readJsonBody } from '../../../../lib/ai/read-body';
import { researchRequest } from '../../../../lib/research/contracts';
import { planResearch } from '../../../../lib/research/planner';
import { retrieveResearch } from '../../../../lib/research/retrieve';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = researchRequest.safeParse(await readJsonBody(request, LIMITS.bodyBytes));
    if (!parsed.success) throw new AiError('invalid_request');
    const body = parsed.data;
    const account = await authorizeAi(body.organizationId);
    const config = aiConfig();
    if (!config) throw new AiError('unavailable', 503);
    const digest = createHmac('sha256', config.key)
      .update(`research|${account.user.id}|${JSON.stringify(body)}`)
      .digest('hex');
    const reserved = await account.db.rpc('reserve_ai_request', {
      org: body.organizationId,
      request_id: body.requestId,
      digest,
      org_limit: config.orgLimit,
      user_limit: config.userLimit,
    });
    if (reserved.error) throw new AiError('unavailable', 503);
    if (reserved.data !== 'reserved')
      throw new AiError(
        String(reserved.data),
        reserved.data === 'forbidden' ? 403 : reserved.data === 'unavailable' ? 503 : 429,
      );
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(LIMITS.timeoutMs)]);
    const plan = await planResearch(
      new OpenAI({ apiKey: config.key, maxRetries: 0, timeout: LIMITS.timeoutMs }),
      config.model,
      body.prompt,
      body.previousPlan,
      new Date().toISOString(),
      signal,
    );
    // All company data stays out of the model call; deterministic code compares authorized records.
    const current = await authorizeAi(body.organizationId);
    const setting = await current.db
      .from('ai_organization_settings')
      .select('enabled')
      .eq('organization_id', body.organizationId)
      .maybeSingle();
    if (
      current.user.id !== account.user.id ||
      current.role !== account.role ||
      setting.error ||
      !setting.data?.enabled ||
      !aiConfig()
    )
      throw new AiError('forbidden', 403);
    const report = await retrieveResearch(
      current.db,
      body.organizationId,
      current.role,
      plan,
      new Date().toISOString(),
      process.env.BIDXCHANGE_SOURCES_ENABLED === 'true',
    );
    const final = await authorizeAi(body.organizationId);
    if (final.user.id !== current.user.id || final.role !== current.role || signal.aborted)
      throw new AiError('cancelled', 499);
    const audit = await final.db.from('research_run_audit').insert({
      id: body.requestId,
      organization_id: body.organizationId,
      user_id: final.user.id,
      filter_digest: createHmac('sha256', config.key).update(JSON.stringify(plan)).digest('hex'),
      sources: report.sources.map((s) => s.id),
      reviewed: report.reviewed,
      returned: report.results.length,
      partial: report.partial,
      result_ids: report.results.map((r) => r.notice.id),
    });
    if (audit.error) throw new AiError('service_unavailable', 503);
    console.info(
      JSON.stringify({
        event: 'opportunity_research',
        requestId: body.requestId,
        organizationId: body.organizationId,
        userId: current.user.id,
        sources: report.sources.length,
        reviewed: report.reviewed,
        returned: report.results.length,
        partial: report.partial,
      }),
    );
    return Response.json({ requestId: body.requestId, report }, { headers });
  } catch (error) {
    const e = error instanceof AiError ? error : new AiError('service_unavailable', 503);
    return Response.json(
      { message: errorMessages[e.code] ?? errorMessages.service_unavailable },
      { status: e.status, headers },
    );
  }
}
