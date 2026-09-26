import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { TenantData } from '../apps/web/lib/tenant-types';

test('company page loads only its authorized saved summary and other routes do not preload profiles', async () => {
  const org = '11111111-1111-4111-8111-111111111111',
    foreign = '22222222-2222-4222-8222-222222222222';
  const queries: { table: string; filters: Record<string, unknown> }[] = [];
  const tables: Record<string, Record<string, unknown>[]> = {
    organization_memberships: [
      {
        user_id: 'user',
        status: 'active',
        role: 'viewer',
        organizations: { id: org, operating_name: 'Fictional contractor' },
        organization_id: org,
      },
    ],
    organizations: [{ id: org, operating_name: 'Fictional contractor' }],
    company_profiles: [
      {
        id: 'profile',
        organization_id: org,
        summary: 'Saved authorized website summary',
        updated_at: '2026-09-26T12:00:00Z',
      },
      { id: 'foreign-profile', organization_id: foreign, summary: 'FOREIGN MUST NOT APPEAR' },
    ],
  };
  const fixture = {
    db: {
      auth: {
        async getUser() {
          return { data: { user: { id: 'user' } } };
        },
      },
      async rpc() {
        return { data: [], error: null };
      },
      from(table: string) {
        const filters: Record<string, unknown> = {};
        queries.push({ table, filters });
        let single = false;
        const result = () => {
          const rows = (tables[table] ?? []).filter((row) =>
            Object.entries(filters).every(([k, v]) => row[k] === v),
          );
          return { data: single ? (rows[0] ?? null) : rows, error: null };
        };
        const q = {
          select() {
            return q;
          },
          eq(k: string, v: unknown) {
            filters[k] = v;
            return q;
          },
          order() {
            return q;
          },
          limit() {
            return q;
          },
          overrideTypes() {
            return q;
          },
          async single() {
            single = true;
            return result();
          },
          async maybeSingle() {
            single = true;
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
  const built = await build({
    entryPoints: ['apps/web/lib/tenant.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    plugins: [
      {
        name: 'auth-fixture',
        setup(b) {
          b.onResolve(
            {
              filter:
                /^(server-only|next\/navigation)$|supabase\/server$|evidence-monitor-records$/,
            },
            (args) => ({ path: args.path, namespace: 'mock' }),
          );
          b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({
            contents:
              path === 'server-only'
                ? ''
                : path === 'next/navigation'
                  ? `export function notFound(){throw new Error('not-found')};export function redirect(){throw new Error('redirect')}`
                  : path.endsWith('evidence-monitor-records')
                    ? `export async function loadEvidenceMonitoring(){return null}`
                    : `export async function createSupabaseServer(){return fixture.db;}`,
          }));
        },
      },
    ],
  });
  const compiled = {
    exports: {} as { loadTenant: (id: string, next: string) => Promise<{ data: TenantData }> },
  };
  new Function('module', 'exports', 'require', 'fixture', built.outputFiles[0].text)(
    compiled,
    compiled.exports,
    createRequire(path.resolve('package.json')),
    fixture,
  );
  const loaded = await compiled.exports.loadTenant(org, `/company?organization=${org}`);
  expect(loaded.data.companyProfile?.summary).toBe('Saved authorized website summary');
  expect(queries.filter((q) => q.table === 'company_profiles')).toEqual([
    { table: 'company_profiles', filters: { organization_id: org } },
  ]);
  await expect(
    compiled.exports.loadTenant(foreign, `/company?organization=${foreign}`),
  ).rejects.toThrow('not-found');
  queries.length = 0;
  expect((await compiled.exports.loadTenant(org, '/dashboard')).data.companyProfile).toBeNull();
  expect(queries.some((q) => q.table === 'company_profiles')).toBe(false);
});
