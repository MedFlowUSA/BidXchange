import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import { sealSavedConversation } from '../apps/web/lib/ai/saved-conversation';
import { readConversation, evidenceHash } from '../apps/web/lib/ai/conversation';
import type { Answer } from '../apps/web/lib/ai/contracts';

test('saved chat API revalidates sources and identity, preserves follow-ups, deletes and rejects forged content', async () => {
  const org = '11111111-1111-4111-8111-111111111111',
    bid = '22222222-2222-4222-8222-222222222222';
  const scope = {
    user: 'user',
    organization: org,
    role: 'viewer',
    mode: 'workspace',
    context: JSON.stringify({ kind: 'pursuit', id: bid }),
  };
  const record = {
    citation: {
      key: 'pursuit:' + bid,
      id: bid,
      type: 'pursuit',
      title: 'Fictional bid',
      updatedAt: '2026-09-26',
      status: 'pending',
      sourceDate: null,
      href: null,
    },
    fields: { value: 'original' },
  };
  const memory = readConversation(undefined, 'secret', scope);
  memory.turns = [{ question: 'Help plan', answer: 'Check the deadline' }];
  memory.refs = [{ type: 'pursuit', id: bid, hash: evidenceHash(record) }];
  const answer: Answer = {
    answer: [{ text: 'Check the deadline', sources: [record.citation.key] }],
    evidence: [record],
    citations: [record.citation],
    risks: [],
    nextAction: 'Review',
    notice: 'AI',
    actionToken: 'DO_NOT_REPLAY',
  };
  const token = sealSavedConversation(
    memory,
    answer,
    bid,
    '33333333-3333-4333-8333-333333333333',
    'secret',
  )!;
  const fixture = {
    user: 'user',
    role: 'viewer',
    enabled: true,
    record: structuredClone(record),
    row: null as Record<string, unknown> | null,
    filters: [] as Record<string, unknown>[],
    db: {
      from(table: string) {
        const filters: Record<string, unknown> = {};
        fixture.filters.push(filters);
        let operation = 'select',
          value: Record<string, unknown> | null = null;
        const result = () => {
          if (operation === 'upsert') fixture.row = value;
          if (operation === 'delete') fixture.row = null;
          return {
            data: table === 'ai_organization_settings' ? { enabled: fixture.enabled } : fixture.row,
            error: null,
          };
        };
        const q = {
          select() {
            return q;
          },
          eq(k: string, v: unknown) {
            filters[k] = v;
            return q;
          },
          upsert(v: Record<string, unknown>) {
            operation = 'upsert';
            value = v;
            return q;
          },
          delete() {
            operation = 'delete';
            return q;
          },
          async maybeSingle() {
            return result();
          },
          then(resolve: (v: unknown) => unknown) {
            return Promise.resolve(result()).then(resolve);
          },
        };
        return q;
      },
    },
  };
  const out = await build({
    entryPoints: ['apps/web/app/api/assistant/conversations/route.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    plugins: [
      {
        name: 'mock',
        setup(b) {
          b.onResolve({ filter: /lib\/ai\/(server|config|tools)$/ }, (args) => ({
            path: args.path.split('/').pop()!,
            namespace: 'fixture',
          }));
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
            contents: (
              {
                server: `export function requireSameOrigin(r){if(r.headers.get('origin')!=='https://app.test')throw Error()};export async function authorizeAi(){return {db:fixture.db,user:{id:fixture.user},role:fixture.role}}`,
                config: `export const aiConfig=()=>({key:'secret'});`,
                tools: `export class EvidenceTools {async restrictToContext(){}async source(){return fixture.record;}}`,
              } as Record<string, string>
            )[path],
          }));
        },
      },
    ],
  });
  const mod = {
    exports: {} as {
      POST: (r: Request) => Promise<Response>;
      GET: (r: Request) => Promise<Response>;
    },
  };
  new Function('module', 'exports', 'require', 'fixture', out.outputFiles[0].text)(
    mod,
    mod.exports,
    createRequire(path.resolve('package.json')),
    fixture,
  );
  const call = (action: string, extra: Record<string, unknown> = {}) =>
    mod.exports.POST(
      new Request('https://app.test/api/assistant/conversations', {
        method: 'POST',
        headers: { origin: 'https://app.test', 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: org, pursuitId: bid, action, ...extra }),
      }),
    );
  expect((await call('save', { checkpoint: token })).status).toBe(200);
  expect(JSON.stringify(fixture.row)).not.toContain('Check the deadline');
  const resumed = await call('resume');
  expect(resumed.status).toBe(200);
  const body = await resumed.json();
  expect(body.answer.actionToken).toBeUndefined();
  expect(readConversation(body.answer.continuation, 'secret', scope).turns[0].question).toBe(
    'Help plan',
  );
  expect(
    fixture.filters.some(
      (f) => f.organization_id === org && f.user_id === 'user' && f.pursuit_id === bid,
    ),
  ).toBe(true);
  fixture.record.fields.value = 'changed';
  expect((await call('resume')).status).toBe(409);
  fixture.record.fields.value = 'original';
  for (const [key, value] of [
    ['user', 'other'],
    ['role', 'estimator'],
  ] as const) {
    const old = fixture[key];
    fixture[key] = value;
    expect((await call('resume')).status).toBe(409);
    fixture[key] = old;
  }
  expect(
    (await call('resume', { organizationId: '44444444-4444-4444-8444-444444444444' })).status,
  ).toBe(409);
  expect((await call('resume', { pursuitId: '44444444-4444-4444-8444-444444444444' })).status).toBe(
    409,
  );
  expect((await call('save', { checkpoint: 'forged' })).status).toBe(409);
  fixture.enabled = false;
  expect((await call('resume')).status).toBe(503);
  expect((await call('delete')).status).toBe(200);
  expect(fixture.row).toBeNull();
});
