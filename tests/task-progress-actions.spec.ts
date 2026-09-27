import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';

test('task progress action scopes writes and distinguishes stale rejection from uncertain transport', async () => {
  const org = '11111111-1111-4111-8111-111111111111';
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let response: { data: string | null; error: { code: string; message: string } | null } = {
    data: 'saved',
    error: null,
  };
  let timedOut = false;
  const fixture = {
    user: { id: 'test-user' },
    choices: [{ id: org, role: 'estimator' }],
    supabase: {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return {
          async abortSignal(signal: AbortSignal) {
            expect(signal).toBeInstanceOf(AbortSignal);
            expect(signal.aborted).toBe(false);
            if (timedOut) throw new Error('Synthetic transport timeout');
            return response;
          },
        };
      },
    },
  };
  const bundle = await build({
    entryPoints: ['apps/web/app/task-progress-actions.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
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
      saveTaskProgress: (
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
  for (const [key, value] of Object.entries({
    organization_id: org,
    pursuit_id: '22222222-2222-4222-8222-222222222222',
    record_id: '33333333-3333-4333-8333-333333333333',
    updated_at: '2026-09-26T12:00:00.123456Z',
    status: 'complete',
  }))
    form.set(key, value);
  form.set('assigned_user_id', 'forged');
  form.set('title', 'forged title');
  const save = () => compiled.exports.saveTaskProgress({ message: '' }, form);
  expect((await save()).success).toBe(true);
  expect(calls[0]).toEqual({
    name: 'update_pursuit_task_progress',
    args: {
      org,
      pursuit: form.get('pursuit_id'),
      task_id: form.get('record_id'),
      expected_version: form.get('updated_at'),
      progress_status: 'complete',
    },
  });
  response = {
    data: null,
    error: { code: 'P0001', message: 'Task changed; reload before saving' },
  };
  expect((await save()).message).toContain('Progress not saved. The task changed');
  response = { data: null, error: { code: '', message: 'AbortError' } };
  expect((await save()).message).toContain('Save not confirmed');
  timedOut = true;
  expect((await save()).message).toContain('Refresh to check the saved task');
  const count = calls.length;
  fixture.choices[0].role = 'viewer';
  expect((await save()).success).not.toBe(true);
  fixture.choices[0].role = 'estimator';
  form.set('organization_id', '44444444-4444-4444-8444-444444444444');
  expect((await save()).success).not.toBe(true);
  form.set('organization_id', org);
  form.set('status', 'approved');
  expect((await save()).success).not.toBe(true);
  expect(calls).toHaveLength(count);
});
