// OFFLINE REVIEW PACKAGE. No application route imports this module.
// Install only in a separately approved, protected, unaliased Production runtime.
export const fixedPayload = Object.freeze({
  model: 'gpt-5.6-luna',
  input: 'Reply with OK.',
  store: false,
  reasoning: Object.freeze({ effort: 'none' }),
  max_output_tokens: 32,
});
const stagingUrl = 'https://svimdvbgtltmyaubfaux.supabase.co';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const result = (status, body) => Response.json(body, { status, headers });
export function makeHandler(env, dependencies) {
  return async (request) => {
    try {
      const url = new URL(request.url);
      if (
        env.VERCEL_ENV !== 'production' ||
        env.BIDXCHANGE_DIAGNOSTIC_ENABLED !== 'true' ||
        env.BIDXCHANGE_AI_ENABLED !== 'false' ||
        env.BIDXCHANGE_AI_DEMO_ENABLED !== 'false' ||
        !env.OPENAI_API_KEY ||
        !env.BIDXCHANGE_DIAGNOSTIC_STAGING_KEY ||
        !uuid.test(env.BIDXCHANGE_DIAGNOSTIC_RUN_ID ?? '') ||
        !uuid.test(env.BIDXCHANGE_DIAGNOSTIC_OPERATOR_ID ?? '') ||
        !/^bidxchange-[a-z0-9]+-manuel-rodriguezs-projects-f5946c44\.vercel\.app$/.test(
          env.VERCEL_URL ?? '',
        ) ||
        url.origin !== `https://${env.VERCEL_URL}` ||
        request.method !== 'POST' ||
        url.search ||
        request.headers.get('origin') !== url.origin ||
        request.body !== null
      )
        return result(404, { status: 'unavailable' });
      const authorization = request.headers.get('authorization') ?? '';
      if (!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization))
        return result(404, { status: 'unavailable' });
      const token = authorization.slice(7);
      if ((await dependencies.authorize(token)) !== env.BIDXCHANGE_DIAGNOSTIC_OPERATOR_ID)
        return result(404, { status: 'unavailable' });
      // Durable claim precedes the provider call. Failed/ambiguous calls cannot be retried.
      if (!(await dependencies.claim(env.BIDXCHANGE_DIAGNOSTIC_RUN_ID, token)))
        return result(409, { status: 'not_armed_or_consumed' });
      try {
        const response = await dependencies.request(fixedPayload);
        const usage = response.usage;
        const valid =
          usage &&
          ['input_tokens', 'output_tokens', 'total_tokens'].every(
            (k) => Number.isSafeInteger(usage[k]) && usage[k] >= 0 && usage[k] <= 1000000,
          );
        const cached = valid
          ? Math.min(
              usage.input_tokens,
              Math.max(0, Number(usage.input_tokens_details?.cached_tokens) || 0),
            )
          : 0;
        return result(200, {
          status: 'http_success',
          model: /^gpt-5\.6-luna(?:-\d{4}-\d{2}-\d{2})?$/.test(response.model ?? '')
            ? response.model
            : 'unexpected_model',
          text: response.output_text?.trim() === 'OK' ? 'OK' : 'unexpected_output',
          inputTokens: valid ? usage.input_tokens : null,
          outputTokens: valid ? usage.output_tokens : null,
          totalTokens: valid ? usage.total_tokens : null,
          estimatedCostUSD: valid
            ? Number(
                (
                  ((usage.input_tokens - cached) * 0.2) / 1e6 +
                  (cached * 0.02) / 1e6 +
                  (usage.output_tokens * 1.2) / 1e6
                ).toFixed(10),
              )
            : null,
          conservativeCostUSD: valid
            ? Number(
                ((usage.input_tokens * 0.25) / 1e6 + (usage.output_tokens * 1.2) / 1e6).toFixed(10),
              )
            : null,
          retryOccurred: false,
          store: false,
          tenantDataSent: false,
        });
      } catch (error) {
        const classification =
          error?.status === 401
            ? 'authentication_failed'
            : error?.status === 403
              ? 'permission_denied'
              : error?.status === 404
                ? 'model_unavailable'
                : error?.status === 429
                  ? 'quota_or_rate_limited'
                  : 'provider_or_network_failure';
        return result(502, {
          status: classification,
          retryOccurred: false,
          store: false,
          tenantDataSent: false,
        });
      }
    } catch {
      return result(503, { status: 'authorization_or_claim_unavailable' });
    }
  };
}
// This factory is only called inside the approved server runtime, never by local tests.
export async function POST(request) {
  const { createClient } = await import('@supabase/supabase-js');
  const env = process.env;
  const client = (token) =>
    createClient(stagingUrl, env.BIDXCHANGE_DIAGNOSTIC_STAGING_KEY ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  return makeHandler(env, {
    authorize: async (token) => {
      const { data, error } = await client(token).auth.getUser(token);
      return error ? null : data.user?.id;
    },
    claim: async (run, token) => {
      const { data, error } = await client(token).rpc('claim_provider_diagnostic', { run });
      if (error) throw new Error('Claim unavailable');
      return data === true;
    },
    request: async (payload) => {
      const { default: OpenAI } = await import('openai');
      const provider = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        project: 'proj_uC3tLIZilUKSlZtrIhdQlQ34',
        baseURL: 'https://api.openai.com/v1',
        maxRetries: 0,
        timeout: 15000,
      });
      return provider.responses.create(payload);
    },
  })(request);
}
