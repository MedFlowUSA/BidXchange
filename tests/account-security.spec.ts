import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

test('global sign-out requires confirmation and verified identity, fails closed and cannot target another user', async () => {
  const output = await build({
    entryPoints: ['apps/web/app/(workspace)/settings/security/actions.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    plugins: [
      {
        name: 'fixture',
        setup(b) {
          b.onResolve({ filter: /supabase\/server$/ }, () => ({
            path: 'auth',
            namespace: 'fixture',
          }));
          b.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: 'navigation',
            namespace: 'fixture',
          }));
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            contents:
              args.path === 'auth'
                ? 'export async function createSupabaseServer(){return fixture;}'
                : 'export function redirect(path){throw new Error("REDIRECT:"+path);}',
          }));
        },
      },
    ],
  });
  let authenticated = true,
    failure = false;
  const calls: unknown[] = [];
  const fixture = {
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? { id: 'current-user' } : null },
        error: null,
      }),
      signOut: async (args: unknown) => {
        calls.push(args);
        return { error: failure ? { message: 'private details' } : null };
      },
    },
  };
  const module = {
    exports: {} as {
      signOutAllDevices: (s: { message: string }, f: FormData) => Promise<{ message: string }>;
    },
  };
  new Function('module', 'exports', 'fixture', output.outputFiles[0].text)(
    module,
    module.exports,
    fixture,
  );
  const form = new FormData();
  expect((await module.exports.signOutAllDevices({ message: '' }, form)).message).toContain(
    'Confirm',
  );
  expect(calls).toEqual([]);
  form.set('confirm', 'yes');
  authenticated = false;
  expect((await module.exports.signOutAllDevices({ message: '' }, form)).message).toContain(
    'Sign in again',
  );
  expect(calls).toEqual([]);
  authenticated = true;
  failure = true;
  expect((await module.exports.signOutAllDevices({ message: '' }, form)).message).toBe(
    'Sign-out could not be confirmed. Please try again.',
  );
  failure = false;
  form.set('user_id', 'someone-else');
  form.set('scope', 'local');
  await expect(module.exports.signOutAllDevices({ message: '' }, form)).rejects.toThrow(
    'REDIRECT:/login?notice=sessions-ended',
  );
  expect(calls).toEqual([{ scope: 'global' }, { scope: 'global' }]);
});

test('account security is protected and signed-out notices describe the token expiry limit', async ({
  page,
}) => {
  await page.goto('/settings/security');
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings%2Fsecurity/);
  await expect(page.getByRole('heading', { name: 'Account security', exact: true })).toHaveCount(0);
  await page.goto('/login?notice=sessions-ended');
  await expect(
    page.locator('main').getByRole('status').filter({ hasText: 'Your sessions' }),
  ).toContainText('token expires');
});
