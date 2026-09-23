import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
test('decision server action preserves multiple reasons, gates no-bid and does not trust a forged organization', async () => {
  const org = '11111111-1111-4111-8111-111111111111';
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const fixture = {
    user: { id: 'test-user' },
    choices: [{ id: org, role: 'organization_admin' }],
    supabase: {
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return { data: 'saved', error: null };
      },
    },
  };
  const bundle = await build({
    entryPoints: ['apps/web/app/decision-actions.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    define: {
      'process.env.BIDXCHANGE_DECISIONS_ENABLED': '"true"',
      'process.env.BIDXCHANGE_REGISTER_SIGNOFF_ENABLED': '"true"',
      'process.env.BIDXCHANGE_DECISION_MEMORY_ENABLED': '"true"',
    },
    plugins: [
      {
        name: 'auth',
        setup(b) {
          b.onResolve({ filter: /lib\/tenant$/ }, () => ({ path: 'tenant', namespace: 'fixture' }));
          b.onResolve({ filter: /^next\/cache$/ }, () => ({ path: 'cache', namespace: 'fixture' }));
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
            contents:
              path === 'tenant'
                ? 'export async function accountContext(){return fixture;}'
                : 'export function revalidatePath(){}',
          }));
        },
      },
    ],
  });
  const compiled = {
    exports: {} as {
      recordDecision: (
        state: { message: string },
        form: FormData,
      ) => Promise<{ success?: boolean; message: string }>;
    },
  };
  new Function('module', 'exports', 'require', 'fixture', bundle.outputFiles[0].text)(
    compiled,
    compiled.exports,
    createRequire(path.resolve('package.json')),
    fixture,
  );
  const form = new FormData();
  for (const [k, v] of Object.entries({
    organization_id: org,
    pursuit_id: '22222222-2222-4222-8222-222222222222',
    version: '2026-09-22T12:00:00Z',
    context: 'a'.repeat(32),
    decision: 'no_bid',
    reason: 'Bond capacity and a meeting conflict',
    conditions: '',
    acknowledged: 'on',
  }))
    form.set(k, v);
  expect((await compiled.exports.recordDecision({ message: '' }, form)).success).not.toBe(true);
  expect(calls).toHaveLength(0);
  form.append('reason_codes', 'bond');
  form.append('reason_codes', 'site_visit');
  expect((await compiled.exports.recordDecision({ message: '' }, form)).success).toBe(true);
  expect(calls[0]).toMatchObject({
    name: 'record_company_decision',
    args: { reason_codes: ['bond', 'site_visit'], org, outcome: 'no_bid' },
  });
  form.set('organization_id', '33333333-3333-4333-8333-333333333333');
  expect((await compiled.exports.recordDecision({ message: '' }, form)).success).not.toBe(true);
  expect(calls).toHaveLength(1);
});
