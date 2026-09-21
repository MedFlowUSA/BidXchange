import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server.js';
test('public route gates cookies, tenant fields, quotas and provider access', async () => {
  const prior = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test',
    VERCEL: '1',
    BIDXCHANGE_AI_PUBLIC_DEMO_ENABLED: 'true',
    OPENAI_API_KEY: 'synthetic',
    OPENAI_MODEL: 'gpt-5.6-luna',
    SUPABASE_URL: 'https://synthetic.supabase.co',
    BIDXCHANGE_DEMO_AI_SERVICE_KEY: 'synthetic-server-key',
  });
  const state = { calls: [], reservation: 'reserved', enabled: true };
  globalThis.__publicDemoTest = state;
  await build({
    entryPoints: ['apps/web/app/api/demo-assistant/route.ts'],
    outfile: '.tmp/public-demo-route.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    plugins: [
      {
        name: 'mock-services',
        setup(b) {
          b.onResolve({ filter: /^(openai|@supabase\/supabase-js)$/ }, (a) => ({
            path: a.path,
            namespace: 'mock',
          }));
          b.onLoad({ filter: /.*/, namespace: 'mock' }, (a) => ({
            contents:
              a.path === 'openai'
                ? `export default class OpenAI {responses={create:async input=>{globalThis.__publicDemoTest.calls.push(input);return {status:'completed',output_text:'Synthetic answer',output:[]};}}}`
                : `export function createClient(){return {from(name){if(name!=='demo_ai_settings')throw Error('Tenant access attempted');return {select(){return {eq(){return {single:async()=>({data:{enabled:globalThis.__publicDemoTest.enabled},error:null})}}}}}},rpc:async(name)=>{if(name!=='reserve_demo_ai')throw Error('Unexpected RPC');return {data:globalThis.__publicDemoTest.reservation,error:null};}}}`,
          }));
        },
      },
    ],
  });
  try {
    const route = createRequire(import.meta.url)('../.tmp/public-demo-route.cjs');
    const init = await route.GET(new NextRequest('http://127.0.0.1:3000/api/demo-assistant'));
    const cookie = init.headers.get('set-cookie').split(';')[0];
    assert.match(init.headers.get('set-cookie'), /HttpOnly/i);
    const request = (body, extra = {}) =>
      new NextRequest('http://127.0.0.1:3000/api/demo-assistant', {
        method: 'POST',
        headers: {
          origin: 'http://127.0.0.1:3000',
          cookie,
          'content-type': 'application/json',
          'x-vercel-forwarded-for': '192.0.2.1',
          ...extra,
        },
        body: JSON.stringify(body),
      });
    const input = { requestId: randomUUID(), prompt: 'Explain a bid bond.' };
    assert.equal((await route.POST(request(input, { cookie: 'bidx-demo-ai=forged' }))).status, 403);
    assert.equal(
      (await route.POST(request({ ...input, organizationId: randomUUID() }))).status,
      400,
    );
    assert.equal(
      (await route.POST(request(input, { origin: 'https://foreign.invalid' }))).status,
      403,
    );
    state.reservation = 'daily_limit';
    assert.equal((await route.POST(request(input))).status, 429);
    assert.equal(state.calls.length, 0);
    state.reservation = 'reserved';
    const success = await route.POST(request(input));
    assert.equal(success.status, 200);
    assert.equal((await success.json()).answer, 'Synthetic answer');
    assert.equal(state.calls.length, 1);
    assert.equal(state.calls[0].store, false);
    assert.equal(state.calls[0].max_output_tokens, 600);
    assert.equal(state.calls[0].tools, undefined);
    assert.deepEqual(state.calls[0].input, [{ role: 'user', content: input.prompt }]);
    state.enabled = false;
    assert.equal(
      (
        await route
          .GET(new NextRequest('http://127.0.0.1:3000/api/demo-assistant'))
          .then((r) => r.json())
      ).available,
      false,
    );
  } finally {
    delete globalThis.__publicDemoTest;
    for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key];
    Object.assign(process.env, prior);
  }
});
