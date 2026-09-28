import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import { qualificationData } from './fixtures/qualification-data';
import { org, pursuit, user } from './fixtures/workflow-data';
test('report endpoint enforces tenant, role, saved version, rate, and source changes after rendering', async () => {
  const data = qualificationData();
  data.responsePackages![0].id = '88888888-8888-4888-8888-888888888888';
  const fixture = {
    signedIn: true,
    member: true,
    role: 'organization_admin',
    rate: true,
    loads: 0,
    rendered: 0,
    change: '',
    data,
    async accountContext() {
      return {
        user: this.signedIn ? { id: user } : null,
        choices: this.member ? [{ id: org, role: this.role }] : [],
        supabase: this.db,
      };
    },
    async loadTenant(id: string, _next: string, record: { id: string }) {
      expect(id).toBe(org);
      expect(record.id).toBe(pursuit);
      this.loads++;
      const copy = structuredClone(this.data);
      copy.organization.role = this.role;
      if (this.loads % 2 === 0) {
        if (this.change === 'fact') copy.facts[0].value = 'Changed fact';
        if (this.change === 'answer') copy.responsePackages![0].content = '{}';
        if (this.change === 'review') copy.resolutions![0].review_current = false;
      }
      return { data: copy };
    },
    db: {
      async rpc() {
        return { data: fixture.rate, error: null };
      },
      from(table: string) {
        expect(['pursuits', 'company_profiles']).toContain(table);
        const filters: Record<string, string> = {};
        const q = {
          select() {
            return q;
          },
          eq(k: string, v: string) {
            filters[k] = v;
            return q;
          },
          async maybeSingle() {
            if (table === 'company_profiles') {
              expect(filters.organization_id).toBe(org);
              return {
                data: {
                  id: 'profile',
                  summary:
                    fixture.change === 'profile' && fixture.loads % 2 === 0
                      ? 'Changed description'
                      : 'Synthetic company description',
                  updated_at: '2026-09-28T00:00:00Z',
                },
                error: null,
              };
            }
            return {
              data:
                filters.organization_id === org && filters.id === pursuit ? { id: pursuit } : null,
              error: null,
            };
          },
        };
        return q;
      },
    },
  };
  const output = await build({
    entryPoints: ['apps/web/app/api/bid-reports/route.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    plugins: [
      {
        name: 'fixture',
        setup(b) {
          b.onResolve({ filter: /lib\/(tenant|response-render)$/ }, (args) => ({
            path: args.path.endsWith('/tenant') ? 'tenant' : 'renderer',
            namespace: 'mock',
          }));
          b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({
            contents:
              path === 'tenant'
                ? `export const accountContext=()=>fixture.accountContext();export const loadTenant=(...args)=>fixture.loadTenant(...args);`
                : `export class ResponseRenderError extends Error{};export async function renderResponsePdf(_d,_a,purpose){if(purpose!=='report')throw Error('Wrong purpose');fixture.rendered++;if(fixture.change==='role')fixture.role='viewer';if(fixture.change==='revoke')fixture.member=false;return new Uint8Array([37,80,68,70]);}`,
          }));
        },
      },
    ],
  });
  const compiled = { exports: {} as { GET: (r: Request) => Promise<Response> } };
  new Function('module', 'exports', 'require', 'fixture', output.outputFiles[0].text)(
    compiled,
    compiled.exports,
    createRequire(path.resolve('package.json')),
    fixture,
  );
  const get = (overrides: Record<string, string> = {}) => {
    fixture.loads = 0;
    return compiled.exports.GET(
      new Request(
        'https://bidxapp.vercel.app/api/bid-reports?' +
          new URLSearchParams({ organization: org, pursuit, ...overrides }),
      ),
    );
  };
  fixture.signedIn = false;
  expect((await get()).status).toBe(401);
  fixture.signedIn = true;
  expect((await get({ organization: user })).status).toBe(404);
  expect((await get({ pursuit: user })).status).toBe(404);
  expect(fixture.loads).toBe(0);
  fixture.rate = false;
  expect((await get()).status).toBe(429);
  fixture.rate = true;
  expect((await get({ package: data.responsePackages![0].id })).status).toBe(400);
  expect((await get({ package: user, version: data.responsePackages![0].updated_at })).status).toBe(
    422,
  );
  fixture.role = 'viewer';
  expect((await get({ restricted: 'true' })).status).toBe(403);
  const success = await get();
  expect(success.status).toBe(200);
  expect(success.headers.get('content-type')).toBe('application/pdf');
  expect(success.headers.get('cache-control')).toBe('private, no-store');
  expect(await success.text()).toBe('%PDF');
  fixture.role = 'organization_admin';
  for (const change of ['role', 'revoke', 'fact', 'answer', 'review', 'profile']) {
    fixture.change = change;
    const response = await get({
      package: data.responsePackages![0].id,
      version: data.responsePackages![0].updated_at,
    });
    expect(response.status, change).toBe(['role', 'revoke'].includes(change) ? 403 : 409);
    fixture.role = 'organization_admin';
    fixture.member = true;
  }
  fixture.change = '';
  data.facts = Array(500).fill(data.facts[0]);
  const rendered = fixture.rendered;
  expect((await get()).status).toBe(422);
  expect(fixture.rendered).toBe(rendered);
});
