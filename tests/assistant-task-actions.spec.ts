import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readConversation, sealConversation } from '../apps/web/lib/ai/conversation';
import type { Answer, Evidence } from '../apps/web/lib/ai/contracts';

test('human task save enforces scope, review, freshness, roles and retry-safe task creation', async () => {
  const org = '11111111-1111-4111-8111-111111111111',
    pursuit = '22222222-2222-4222-8222-222222222222',
    user = '33333333-3333-4333-8333-333333333333',
    req = '44444444-4444-4444-8444-444444444444';
  const record = (type: string, id: string): Evidence => ({
    citation: {
      type,
      id,
      key: `${type}:${id}`,
      title: 'Synthetic',
      href: null,
      status: 'needs_review',
      sourceDate: null,
      updatedAt: '2026-09-25',
    },
    fields: { workspaceRoute: `/pursuits/${pursuit}?organization=${org}` },
  });
  const records = [record('pursuit', pursuit), record('requirement', req)];
  const rows: Record<string, unknown>[] = [];
  let insertAttempts = 0;
  const fixture = {
    role: 'organization_admin',
    changed: false,
    revoked: false,
    source(type: string, id: string) {
      if (fixture.revoked) throw Error('revoked');
      const found = records.find((r) => r.citation.type === type && r.citation.id === id);
      if (!found) throw Error('missing');
      return {
        ...found,
        citation: {
          ...found.citation,
          updatedAt: fixture.changed ? 'changed' : found.citation.updatedAt,
        },
      };
    },
    db: {
      async rpc() {
        return { data: true, error: null };
      },
      from(table: string) {
        const filters: Record<string, unknown> = {};
        let insert: Record<string, unknown> | undefined;
        const read = () =>
          table === 'pursuits'
            ? [{ id: pursuit, organization_id: org }]
            : table === 'organization_memberships'
              ? [{ user_id: user, organization_id: org, status: 'active' }]
              : rows;
        const matches = () =>
          read().filter((r) =>
            Object.entries(filters).every(
              ([key, value]) => (r as Record<string, unknown>)[key] === value,
            ),
          );
        const q = {
          select() {
            return q;
          },
          eq(key: string, value: unknown) {
            filters[key] = value;
            return q;
          },
          insert(value: Record<string, unknown>) {
            insert = value;
            return q;
          },
          async single() {
            const data = matches()[0];
            return { data, error: data ? null : 'missing' };
          },
          async maybeSingle() {
            return { data: matches()[0] ?? null, error: null };
          },
          then(resolve: (v: unknown) => void) {
            if (insert) {
              insertAttempts++;
              if (rows.some((r) => r.id === insert!.id))
                return Promise.resolve({ data: null, error: { code: '23505' } }).then(resolve);
              rows.push(insert);
              return Promise.resolve({ data: [{ id: insert.id }], error: null }).then(resolve);
            }
            return Promise.resolve({ data: matches(), error: null }).then(resolve);
          },
        };
        return q;
      },
    },
  };
  const bundle = await build({
    entryPoints: ['apps/web/app/assistant-task-actions.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    define: { 'process.env.BIDXCHANGE_CONTRACTOR_WORKFLOW_ENABLED': '"true"' },
    plugins: [
      {
        name: 'scoped-fixture',
        setup(b) {
          b.onResolve(
            { filter: /(?:lib\/ai\/(?:config|server|tools)|lib\/tenant|^next\/cache)$/ },
            (args) => ({ path: args.path.split('/').pop()!, namespace: 'fixture' }),
          );
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
            contents: (
              {
                config: "export const aiConfig=()=>({key:'synthetic-plan-secret'});",
                server: `export async function authorizeAi(){if(fixture.revoked)throw Error();return {user:{id:'${user}'},role:fixture.role,db:fixture.db};}`,
                tenant: `export async function accountContext(){return {user:{id:'${user}'},supabase:fixture.db,choices:[{id:'${org}',role:fixture.role}]};}`,
                cache: 'export function revalidatePath(){}',
                tools:
                  'export class EvidenceTools {evidence=new Map();async source(type,id){const r=fixture.source(type,id);this.evidence.set(r.citation.key,r);return r;}}',
              } as Record<string, string>
            )[path],
          }));
        },
      },
    ],
  });
  const compiled = {
    exports: {} as {
      saveAssistantTask: (
        state: { message: string },
        form: FormData,
      ) => Promise<{ success?: boolean; message: string; href?: string }>;
    },
  };
  new Function('module', 'exports', 'require', 'fixture', bundle.outputFiles[0].text)(
    compiled,
    compiled.exports,
    createRequire(path.resolve('package.json')),
    fixture,
  );
  const scope = {
    user,
    organization: org,
    role: fixture.role,
    mode: 'workspace',
    context: 'task-plan:' + JSON.stringify({ kind: 'pursuit', id: pursuit }),
  };
  const answer: Answer = {
    answer: [],
    risks: [],
    nextAction: '',
    citations: [],
    evidence: [],
    notice: '',
  };
  const token = sealConversation(
    readConversation(undefined, 'synthetic-plan-secret', scope),
    'synthetic-plan-secret',
    'Review',
    answer,
    records,
  )!;
  const form = new FormData();
  for (const [key, value] of Object.entries({
    organization_id: org,
    pursuit_id: pursuit,
    record_id: '',
    updated_at: '',
    creation_id: '55555555-5555-4555-8555-555555555555',
    title: 'Human-edited task',
    status: 'complete',
    assigned_user_id: user,
    due_at: '',
    due_timezone: 'UTC',
    requirement_id: req,
    priority: 'normal',
    notes: 'Source reviewed',
    action_token: token,
  }))
    form.set(key, value);
  const save = () => compiled.exports.saveAssistantTask({ message: '' }, form);
  expect((await save()).success).not.toBe(true);
  expect(insertAttempts).toBe(0);
  form.set('review_confirmed', 'on');
  for (const change of ['viewer', 'estimator']) {
    fixture.role = change;
    expect((await save()).success).not.toBe(true);
  }
  fixture.role = 'organization_admin';
  fixture.changed = true;
  expect((await save()).success).not.toBe(true);
  fixture.changed = false;
  fixture.revoked = true;
  expect((await save()).success).not.toBe(true);
  fixture.revoked = false;
  form.set('organization_id', user);
  expect((await save()).success).not.toBe(true);
  form.set('organization_id', org);
  form.set('pursuit_id', user);
  expect((await save()).success).not.toBe(true);
  form.set('pursuit_id', pursuit);
  form.set('requirement_id', user);
  expect((await save()).success).not.toBe(true);
  form.set('requirement_id', req);
  form.set('action_token', token + 'tampered');
  expect((await save()).success).not.toBe(true);
  form.set('action_token', token);
  expect(insertAttempts).toBe(0);
  expect((await save()).success).toBe(true);
  expect(rows[0]).toMatchObject({
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Human-edited task',
    status: 'todo',
    requirement_id: req,
    assigned_user_id: user,
    due_at: null,
  });
  expect((await save()).success).toBe(true);
  expect(rows).toHaveLength(1);
});
