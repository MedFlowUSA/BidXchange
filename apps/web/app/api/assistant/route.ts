import OpenAI from 'openai';
import { createHmac } from 'node:crypto';
import { aiConfig } from '../../../lib/ai/config';
import {
  AiError,
  errorMessages,
  LIMITS,
  requestSchema,
  type Evidence,
} from '../../../lib/ai/contracts';
import { authorizeAi, requireSameOrigin } from '../../../lib/ai/server';
import { EvidenceTools } from '../../../lib/ai/tools';
import { runAssistant } from '../../../lib/ai/engine';
import { readJsonBody } from '../../../lib/ai/read-body';
import {
  readConversation,
  checkConversation,
  sealConversation,
} from '../../../lib/ai/conversation';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const json = await readJsonBody(request, LIMITS.bodyBytes);
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) throw new AiError('invalid_request');
    const body = parsed.data;
    const account = await authorizeAi(body.organizationId);
    const config = aiConfig();
    if (!config) throw new AiError('unavailable', 503);
    const evidence = new EvidenceTools(account.db, body.organizationId, account.role);
    const scope = {
      user: account.user.id,
      organization: body.organizationId,
      role: account.role,
      mode: body.mode,
      context: JSON.stringify(body.context),
    };
    const memory = readConversation(body.continuation, config.key, scope);
    await checkConversation(memory, (type, id) => evidence.source(type, id));
    // Validate context before reserving paid work. Never trust client record IDs.
    if (body.mode === 'workspace' && body.context)
      await evidence.run(body.context.kind === 'opportunity' ? 'get_opportunity' : 'get_pursuit', {
        id: body.context.id,
      });
    const digest = createHmac('sha256', config.key)
      .update(
        account.user.id +
          '|' +
          body.organizationId +
          '|' +
          body.prompt +
          '|' +
          JSON.stringify(body.context) +
          '|' +
          body.mode +
          '|' +
          (body.continuation ?? ''),
      )
      .digest('hex');
    const { data: reservation, error } = await account.db.rpc('reserve_ai_request', {
      org: body.organizationId,
      request_id: body.requestId,
      digest,
      org_limit: config.orgLimit,
      user_limit: config.userLimit,
    });
    if (error) throw new AiError('unavailable', 503);
    if (reservation !== 'reserved')
      throw new AiError(
        String(reservation),
        reservation === 'forbidden' ? 403 : reservation === 'unavailable' ? 503 : 429,
      );
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    const timeout = setTimeout(abort, LIMITS.timeoutMs);
    const started = Date.now();
    let disconnected = false;
    const stream = new ReadableStream({
      async start(sink) {
        const emit = (event: unknown) => {
          if (!disconnected) sink.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
        };
        try {
          const result = await runAssistant(
            new OpenAI({ apiKey: config.key, maxRetries: 0, timeout: LIMITS.timeoutMs }),
            config.model,
            body.prompt,
            body.context,
            evidence,
            controller.signal,
            (text) => emit({ type: 'status', text }),
            async () => {
              const fresh = await authorizeAi(body.organizationId);
              if (fresh.user.id !== account.user.id || fresh.role !== account.role)
                throw new AiError('forbidden', 403);
              const { data: setting, error } = await fresh.db
                .from('ai_organization_settings')
                .select('enabled')
                .eq('organization_id', body.organizationId)
                .maybeSingle();
              if (error || !setting?.enabled || !aiConfig()) throw new AiError('unavailable', 503);
            },
            body.mode,
            memory.turns,
          );
          // Recheck citations against current RLS/classification before releasing any evidence.
          const current = new EvidenceTools(account.db, body.organizationId, account.role);
          const records: Evidence[] = [];
          for (const item of evidence.evidence.values()) {
            if (item.citation.type === 'workspace') continue;
            const fresh = await current.source(item.citation.type, item.citation.id);
            if (
              fresh.citation.updatedAt !== item.citation.updatedAt ||
              fresh.citation.status !== item.citation.status
            )
              throw new AiError('conversation_changed', 409);
            records.push(fresh);
          }
          result.answer.evidence = result.answer.evidence.map(
            (item) => records.find((r) => r.citation.key === item.citation.key) ?? item,
          );
          result.answer.citations = result.answer.evidence.map((item) => item.citation);
          result.answer.continuation = sealConversation(
            memory,
            config.key,
            body.prompt,
            result.answer,
            records,
          );
          if (controller.signal.aborted) throw new AiError('cancelled', 499);
          const finalAccess = await authorizeAi(body.organizationId);
          if (finalAccess.user.id !== account.user.id || finalAccess.role !== account.role)
            throw new AiError('forbidden', 403);
          const setting = await finalAccess.db
            .from('ai_organization_settings')
            .select('enabled')
            .eq('organization_id', body.organizationId)
            .maybeSingle();
          if (setting.error || !setting.data?.enabled || !aiConfig())
            throw new AiError('unavailable', 503);
          if (body.mode === 'workspace') result.answer.recordsCheckedAt = new Date().toISOString();
          emit({ type: 'answer', answer: result.answer });
          // Operational totals only. No prompt, tool payload, generated text, key or token logged.
          console.info(
            JSON.stringify({
              event: 'ai_usage',
              requestId: body.requestId,
              organizationId: body.organizationId,
              userId: account.user.id,
              model: config.model,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              milliseconds: Date.now() - started,
              outcome: 'success',
            }),
          );
        } catch (error) {
          const code = controller.signal.aborted
            ? request.signal.aborted
              ? 'cancelled'
              : 'timeout'
            : error instanceof AiError
              ? error.code
              : error instanceof OpenAI.RateLimitError
                ? 'rate_limited'
                : error instanceof OpenAI.APIConnectionTimeoutError
                  ? 'timeout'
                  : 'service_unavailable';
          emit({
            type: 'error',
            code,
            message: errorMessages[code] ?? errorMessages.service_unavailable,
          });
          console.info(
            JSON.stringify({
              event: 'ai_usage',
              requestId: body.requestId,
              organizationId: body.organizationId,
              userId: account.user.id,
              milliseconds: Date.now() - started,
              outcome: code,
            }),
          );
        } finally {
          clearTimeout(timeout);
          request.signal.removeEventListener('abort', abort);
          if (!disconnected) sink.close();
        }
      },
      cancel() {
        disconnected = true;
        controller.abort();
        clearTimeout(timeout);
        request.signal.removeEventListener('abort', abort);
      },
    });
    return new Response(stream, {
      headers: { ...headers, 'Content-Type': 'application/x-ndjson' },
    });
  } catch (error) {
    const e = error instanceof AiError ? error : new AiError('service_unavailable', 503);
    return Response.json(
      { code: e.code, message: errorMessages[e.code] ?? errorMessages.service_unavailable },
      { status: e.status, headers },
    );
  }
}
