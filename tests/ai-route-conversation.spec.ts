import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readConversation } from '../apps/web/lib/ai/conversation';

test('assistant route replays authenticated history, rejects foreign scope before paid work and checks final access', async () => {
  const fixture = {
    user: 'user-a',
    role: 'viewer',
    enabled: true,
    reservations: 0,
    revokeAfterModel: false,
    histories: [] as unknown[],
    planning: false,
    shared: false,
    batch: false,
    changeSharedAfterModel: false,
    excerpts: [] as unknown[],
    requirement: {
      id: '55555555-5555-4555-8555-555555555555',
      requirement: 'All subcontractors supply registration evidence.',
      updated_at: '2026-09-25T00:00:00Z',
    },
    record: {
      citation: {
        key: 'pursuit:22222222-2222-4222-8222-222222222222',
        id: '22222222-2222-4222-8222-222222222222',
        type: 'pursuit',
        title: 'Synthetic pursuit',
        updatedAt: '2026-09-25',
        sourceDate: null,
        status: 'pending',
        href: null,
      },
      fields: {
        workspaceRoute:
          '/pursuits/22222222-2222-4222-8222-222222222222?organization=11111111-1111-4111-8111-111111111111',
      },
    },
    db: {
      async rpc() {
        fixture.reservations++;
        return { data: 'reserved', error: null };
      },
      from(table: string) {
        if (table === 'pursuit_requirements') {
          const query = {
            select() {
              return query;
            },
            eq() {
              return query;
            },
            is() {
              return query;
            },
            in() {
              return query;
            },
            then(resolve: (value: unknown) => unknown) {
              return Promise.resolve(resolve({ data: [fixture.requirement], error: null }));
            },
            async maybeSingle() {
              return { data: fixture.requirement, error: null };
            },
          };
          return query;
        }
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: { enabled: fixture.enabled }, error: null };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
  const output = await build({
    entryPoints: ['apps/web/app/api/assistant/route.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    plugins: [
      {
        name: 'route-fixture',
        setup(b) {
          b.onResolve(
            { filter: /(?:lib\/ai\/(?:config|server|engine|tools)|^openai)$/ },
            (args) => ({ path: args.path.split('/').pop()!, namespace: 'fixture' }),
          );
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
            contents: (
              {
                config: `export const aiConfig=()=>({key:'synthetic-secret',model:'test',orgLimit:10,userLimit:10});`,
                server: `export const requireSameOrigin=()=>{}; export async function authorizeAi(){return {user:{id:fixture.user},role:fixture.role,db:fixture.db};}`,
                tools: `export class EvidenceTools { evidence=new Map(); async restrictToContext(){} async run(){if(fixture.planning)this.evidence.set(fixture.record.citation.key,fixture.record);} async source(type,id){const r=type==='requirement'?{citation:{...fixture.record.citation,type:'requirement',id,key:'requirement:'+id,updatedAt:fixture.requirement.updated_at},fields:{...fixture.record.fields,status:'needs_review'}}:fixture.record;this.evidence.set(r.citation.key,r);return r;} }`,
                engine: `export async function runAssistant(a,b,c,d,e,f,g,authorize,mode,history,shared){
          await authorize(); fixture.histories.push(history);
          fixture.excerpts.push(shared);
          if(fixture.changeSharedAfterModel)fixture.requirement.updated_at='2026-09-26T00:00:00Z';
          if(fixture.revokeAfterModel) fixture.user='revoked-user';
          return {answer:{answer:[{text:'Useful suggested plan.',sources:[]}],risks:[],nextAction:'',citations:[],evidence:[],notice:'AI analysis',...(fixture.planning?{proposedTasks:[{title:'Review pursuit',explanation:'Review the saved record.',sources:[fixture.record.citation.key],requirementKey:null}]}:{})},inputTokens:1,outputTokens:1};
        }`,
                openai: `export default class OpenAI { static RateLimitError=class extends Error{}; static APIConnectionTimeoutError=class extends Error{}; }`,
              } as Record<string, string>
            )[path],
          }));
        },
      },
    ],
  });
  const compiled = { exports: {} as { POST: (r: Request) => Promise<Response> } };
  new Function('module', 'exports', 'require', 'fixture', output.outputFiles[0].text)(
    compiled,
    compiled.exports,
    createRequire(path.resolve('package.json')),
    fixture,
  );
  const post = (continuation?: string) =>
    compiled.exports.POST(
      new Request('https://bidxapp.vercel.app/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: '11111111-1111-4111-8111-111111111111',
          requestId: crypto.randomUUID(),
          prompt: 'Help me plan',
          context: fixture.planning ? { kind: 'pursuit', id: fixture.record.citation.id } : null,
          mode: 'workspace',
          continuation,
          ...(fixture.shared
            ? {
                sharedRequirement: {
                  id: fixture.requirement.id,
                  updatedAt: fixture.requirement.updated_at,
                  consent: true,
                },
              }
            : {}),
          ...(fixture.batch
            ? {
                sharedRequirements: [
                  {
                    id: fixture.requirement.id,
                    updatedAt: fixture.requirement.updated_at,
                    consent: true,
                  },
                ],
              }
            : {}),
        }),
      }),
    );
  const first = await post();
  const event = JSON.parse((await first.text()).trim());
  expect(event.type).toBe('answer');
  expect(event.answer.answer[0].text).toBe('Useful suggested plan.');
  const token = event.answer.continuation;
  expect(typeof token).toBe('string');
  await (await post(token)).text();
  expect(fixture.histories[1]).toEqual([
    { question: 'Help me plan', answer: 'Useful suggested plan.' },
  ]);
  const before = fixture.reservations;
  fixture.user = 'foreign-user';
  const foreign = await post(token);
  expect(foreign.status).toBe(409);
  expect(fixture.reservations).toBe(before);
  fixture.user = 'user-a';
  fixture.revokeAfterModel = true;
  const revoked = await post(token);
  const rejected = JSON.parse((await revoked.text()).trim());
  expect(rejected).toMatchObject({ type: 'error', code: 'forbidden' });
  expect(rejected.answer).toBeUndefined();
  fixture.user = 'user-a';
  fixture.revokeAfterModel = false;
  fixture.planning = true;
  const planned = JSON.parse((await (await post()).text()).trim());
  expect(planned.type).toBe('answer');
  const planScope = {
    user: fixture.user,
    organization: '11111111-1111-4111-8111-111111111111',
    role: fixture.role,
    mode: 'workspace',
    context: 'task-plan:' + JSON.stringify({ kind: 'pursuit', id: fixture.record.citation.id }),
  };
  expect(
    readConversation(planned.answer.actionToken, 'synthetic-secret', planScope).refs.map(
      (r) => r.id,
    ),
  ).toEqual([fixture.record.citation.id]);
  expect(() =>
    readConversation(planned.answer.continuation, 'synthetic-secret', planScope),
  ).toThrow();
  fixture.shared = true;
  const reservations = fixture.reservations;
  expect((await post()).status).toBe(403);
  expect(fixture.reservations).toBe(reservations);
  fixture.role = 'organization_admin';
  const sharedAnswer = JSON.parse((await (await post()).text()).trim()).answer;
  expect(sharedAnswer.sharedRequirement.text).toBe(fixture.requirement.requirement);
  expect(fixture.excerpts.at(-1)).toMatchObject({
    id: fixture.requirement.id,
    text: fixture.requirement.requirement,
  });
  expect(
    readConversation(sharedAnswer.actionToken, 'synthetic-secret', {
      ...planScope,
      role: fixture.role,
    }).refs.map((r) => r.id),
  ).toContain(fixture.requirement.id);
  fixture.shared = false;
  const reserved = fixture.reservations;
  expect((await post(sharedAnswer.continuation)).status).toBe(409);
  expect(fixture.reservations).toBe(reserved);
  fixture.shared = true;
  fixture.changeSharedAfterModel = true;
  const stale = JSON.parse((await (await post()).text()).trim());
  expect(stale).toMatchObject({ type: 'error', code: 'conversation_changed' });
  expect(stale.answer).toBeUndefined();
  fixture.shared = false;
  fixture.batch = true;
  fixture.changeSharedAfterModel = false;
  fixture.role = 'viewer';
  const batchReservations = fixture.reservations;
  expect((await post()).status).toBe(403);
  expect(fixture.reservations).toBe(batchReservations);
  fixture.role = 'organization_admin';
  const reviewed = JSON.parse((await (await post()).text()).trim());
  expect(reviewed.type).toBe('answer');
  expect(reviewed.answer.sharedRequirements).toHaveLength(1);
  expect(Array.isArray(fixture.excerpts.at(-1))).toBe(true);
  fixture.batch = false;
  expect((await post(reviewed.answer.continuation)).status).toBe(409);
  fixture.batch = true;
  fixture.requirement.updated_at = '2026-09-25T00:00:00Z';
  fixture.changeSharedAfterModel = true;
  const staleBatch = JSON.parse((await (await post()).text()).trim());
  expect(staleBatch).toMatchObject({ type: 'error', code: 'conversation_changed' });
  expect(staleBatch.answer).toBeUndefined();
});
