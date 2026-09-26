import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import { handoffFixture } from './fixtures/handoff-data';
import { org, user } from './fixtures/workflow-data';

test('handoff exports enforce tenant/checksum, limits and post-render access/revision checks', async () => {
  const row = handoffFixture();
  const fixture = {
    signedIn: true,
    role: 'viewer',
    member: true,
    rate: true,
    rendered: 0,
    queries: 0,
    statusCalls: 0,
    authCalls: 0,
    changeDuringRender: false,
    revokeDuringRender: false,
    changeHistory: false,
    excess: false,
    async accountContext() {
      this.authCalls++;
      return {
        user: this.signedIn ? { id: user } : null,
        choices: this.member ? [{ id: org, role: this.role }] : [],
        supabase: this.db,
      };
    },
    db: {
      async rpc(name: string) {
        if (name === 'consume_admin_mutation') return { data: fixture.rate, error: null };
        fixture.statusCalls++;
        return {
          data: {
            ...structuredClone(row.status),
            history_revision: fixture.changeHistory && fixture.statusCalls > 1 ? 2 : 1,
          },
          error: null,
        };
      },
      from(table: string) {
        fixture.queries++;
        const filters: Record<string, string> = {};
        const result = () => ({
          data:
            table === 'response_release_versions'
              ? filters.organization_id === org &&
                filters.id === row.id &&
                filters.checksum === row.checksum
                ? structuredClone(row)
                : null
              : fixture.excess
                ? Array(1001).fill({})
                : [],
          error:
            filters.organization_id !== org ||
            (table === 'response_release_versions' && filters.checksum !== row.checksum)
              ? {}
              : null,
        });
        const q = {
          select() {
            return q;
          },
          eq(k: string, v: string) {
            filters[k] = v;
            return q;
          },
          order() {
            return q;
          },
          limit() {
            return q;
          },
          async single() {
            return result();
          },
          then(resolve: (r: unknown) => unknown) {
            return Promise.resolve(result()).then(resolve);
          },
        };
        return q;
      },
    },
  };
  const output = await build({
    entryPoints: ['apps/web/app/api/response-releases/handoff/route.ts'],
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
                ? `export const accountContext=()=>fixture.accountContext();`
                : `export class ResponseRenderError extends Error{};export async function renderResponsePdf(){fixture.rendered++;if(fixture.changeDuringRender)fixture.role='contributor';if(fixture.revokeDuringRender)fixture.member=false;return new Uint8Array([37,80,68,70]);}`,
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
  const prior = process.env.BIDXCHANGE_RELEASES_ENABLED;
  process.env.BIDXCHANGE_RELEASES_ENABLED = 'true';
  const get = (overrides: Record<string, string> = {}) =>
    compiled.exports.GET(
      new Request(
        'https://bidxapp.vercel.app/api/response-releases/handoff?' +
          new URLSearchParams({
            organization: org,
            release: row.id,
            checksum: row.checksum,
            ...overrides,
          }),
      ),
    );
  try {
    fixture.signedIn = false;
    expect((await get()).status).toBe(401);
    fixture.signedIn = true;
    fixture.member = false;
    expect((await get()).status).toBe(404);
    fixture.member = true;
    expect(fixture.queries).toBe(0);
    expect((await get({ checksum: 'c'.repeat(64) })).status).toBe(404);
    fixture.rate = false;
    expect((await get()).status).toBe(429);
    fixture.rate = true;
    expect((await get({ format: 'zip' })).status).toBe(400);
    fixture.statusCalls = 0;
    const json = await get();
    expect(json.status).toBe(200);
    expect((await json.json()).handoff.ready).toBe(true);
    fixture.statusCalls = 0;
    const pdf = await get({ format: 'pdf' });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.headers.get('cache-control')).toBe('private, no-store');
    expect(await pdf.text()).toBe('%PDF');
    fixture.changeDuringRender = true;
    expect((await get({ format: 'pdf' })).status).toBe(403);
    fixture.changeDuringRender = false;
    fixture.role = 'viewer';
    fixture.revokeDuringRender = true;
    expect((await get({ format: 'pdf' })).status).toBe(403);
    fixture.revokeDuringRender = false;
    fixture.member = true;
    fixture.changeHistory = true;
    fixture.statusCalls = 0;
    expect((await get({ format: 'pdf' })).status).toBe(409);
    fixture.changeHistory = false;
    fixture.excess = true;
    const before = fixture.rendered;
    expect((await get({ format: 'pdf' })).status).toBe(422);
    expect(fixture.rendered).toBe(before);
  } finally {
    if (prior === undefined) delete process.env.BIDXCHANGE_RELEASES_ENABLED;
    else process.env.BIDXCHANGE_RELEASES_ENABLED = prior;
  }
});
