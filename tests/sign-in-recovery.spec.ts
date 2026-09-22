import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { signInRecoveryHref, signInUnavailable } from '../apps/web/lib/sign-in-recovery';

test('callback recovery preserves approved destinations and rejects external redirects', () => {
  const next = '/pursuits/123?organization=abc';
  expect(new URL(signInRecoveryHref(next), 'https://example.test').searchParams.get('next')).toBe(
    next,
  );
  for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', null])
    expect(new URL(signInRecoveryHref(bad), 'https://example.test').searchParams.get('next')).toBe(
      '/dashboard',
    );
});

test('authentication outages return safe recovery text; successful verification still redirects', async () => {
  const result = await build({
    entryPoints: ['apps/web/app/login/actions.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    define: { 'process.env.SITE_URL': '"https://example.test"' },
    plugins: [
      {
        name: 'auth-fixture',
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
                ? `export async function createSupabaseServer() { return {auth: { signInWithOtp: async () => { throw new Error('private-provider-details'); }, verifyOtp: async ({token}) => { if(token==='123456') return {error:null}; throw new Error('private-provider-details'); } }}; }`
                : `export function redirect(path) { throw new Error('REDIRECT:'+path); }`,
          }));
        },
      },
    ],
  });
  const compiled = {
    exports: {} as Record<
      string,
      (state: { message: string }, form: FormData) => Promise<{ message: string }>
    >,
  };
  new Function('module', 'exports', result.outputFiles[0].text)(compiled, compiled.exports);
  const form = new FormData();
  form.set('email', ' user@example.test ');
  form.set('token', '111111');
  form.set('next', '/company');
  expect(await compiled.exports.requestSignIn({ message: '' }, form)).toEqual({
    message: signInUnavailable,
  });
  expect(await compiled.exports.verifyCode({ message: '' }, form)).toEqual({
    message: signInUnavailable,
  });
  form.set('token', ' 123456 ');
  await expect(compiled.exports.verifyCode({ message: '' }, form)).rejects.toThrow(
    'REDIRECT:/company',
  );
});

test('sign-in offers actionable recovery and preserves the destination in both forms', async ({
  page,
}) => {
  const next = '/company?organization=11111111-1111-4111-8111-111111111111';
  await page.goto(`/login?error=callback&next=${encodeURIComponent(next)}`);
  await expect(page.locator('main').getByRole('alert')).toContainText('Request a new link');
  await page.getByText('Need help signing in?', { exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Contact BidXchange for access help' }),
  ).toHaveAttribute('href', /^mailto:/);
  expect(
    await page
      .locator('input[name=next]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).value)),
  ).toEqual([next, next]);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
