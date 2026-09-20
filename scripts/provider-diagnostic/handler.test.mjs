import test from 'node:test';
import assert from 'node:assert/strict';
import { fixedPayload, makeHandler } from './handler.mjs';
const operator = '11111111-1111-4111-8111-111111111111';
const env = {
  VERCEL_ENV: 'production',
  VERCEL_URL: 'bidxchange-test-manuel-rodriguezs-projects-f5946c44.vercel.app',
  BIDXCHANGE_DIAGNOSTIC_ENABLED: 'true',
  BIDXCHANGE_AI_ENABLED: 'false',
  BIDXCHANGE_AI_DEMO_ENABLED: 'false',
  OPENAI_API_KEY: 'synthetic-not-a-key',
  BIDXCHANGE_DIAGNOSTIC_STAGING_KEY: 'synthetic-publishable',
  BIDXCHANGE_DIAGNOSTIC_RUN_ID: '22222222-2222-4222-8222-222222222222',
  BIDXCHANGE_DIAGNOSTIC_OPERATOR_ID: operator,
};
const origin = `https://${env.VERCEL_URL}`;
const request = (options = {}) =>
  new Request(origin + '/api/operator/provider-check', {
    method: 'POST',
    headers: { origin, authorization: 'Bearer synthetic.jwt.only' },
    ...options,
  });
test('rejects disabled, Preview, active global AI, wrong identity, and arbitrary input before provider call', async () => {
  let calls = 0;
  const dependencies = {
    authorize: async () => operator,
    claim: async () => true,
    request: async () => {
      calls++;
    },
  };
  for (const change of [
    { BIDXCHANGE_DIAGNOSTIC_ENABLED: 'false' },
    { VERCEL_ENV: 'preview' },
    { BIDXCHANGE_AI_ENABLED: 'true' },
    { BIDXCHANGE_AI_DEMO_ENABLED: 'true' },
    { OPENAI_API_KEY: '' },
    { BIDXCHANGE_DIAGNOSTIC_OPERATOR_ID: 'invalid' },
    { VERCEL_URL: 'bidxapp.vercel.app' },
  ])
    assert.equal((await makeHandler({ ...env, ...change }, dependencies)(request())).status, 404);
  for (const req of [
    request({ method: 'GET' }),
    request({ body: 'custom prompt' }),
    request({ headers: {} }),
    new Request(origin + '/api/operator/provider-check?secret=no', {
      method: 'POST',
      headers: { origin, authorization: 'Bearer synthetic.jwt.only' },
    }),
  ])
    assert.equal((await makeHandler(env, dependencies)(req)).status, 404);
  assert.equal(
    (await makeHandler(env, { ...dependencies, authorize: async () => null })(request())).status,
    404,
  );
  assert.equal(calls, 0);
});
test('durable claim denial prevents calls and fixed payload cannot inherit caller data', async () => {
  let calls = 0,
    claimed = false;
  const handler = makeHandler(env, {
    authorize: async () => operator,
    claim: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    request: async (payload) => {
      calls++;
      assert.deepEqual(payload, {
        model: 'gpt-5.6-luna',
        input: 'Reply with OK.',
        store: false,
        reasoning: { effort: 'none' },
        max_output_tokens: 32,
      });
      return {
        model: 'gpt-5.6-luna',
        output_text: 'OK',
        usage: { input_tokens: 12, output_tokens: 1, total_tokens: 13 },
      };
    },
  });
  const results = await Promise.all(Array.from({ length: 20 }, () => handler(request())));
  assert.equal(calls, 1);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 19);
  assert(Object.isFrozen(fixedPayload) && Object.isFrozen(fixedPayload.reasoning));
});
test('provider failures and unexpected output are sanitized and never retried', async () => {
  let calls = 0;
  const handler = makeHandler(env, {
    authorize: async () => operator,
    claim: async () => true,
    request: async () => {
      calls++;
      throw Object.assign(new Error('RAW_SECRET_SENTINEL'), { status: 429 });
    },
  });
  const response = await handler(request()),
    body = await response.text();
  assert.equal(calls, 1);
  assert(!body.includes('RAW_SECRET'));
  assert(body.includes('quota_or_rate_limited'));
  const unexpected = await makeHandler(env, {
    authorize: async () => operator,
    claim: async () => true,
    request: async () => ({ model: 'SECRET_MODEL', output_text: 'RAW_SECRET_SENTINEL', usage: {} }),
  })(request());
  const safe = await unexpected.json();
  assert.equal(safe.model, 'unexpected_model');
  assert.equal(safe.text, 'unexpected_output');
  assert.equal(safe.inputTokens, null);
  assert.equal(safe.store, false);
});
