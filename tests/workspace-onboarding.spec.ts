import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { companyCreationInput, invitationInput } from '../apps/web/lib/workspace-onboarding';
import { safeNext } from '../apps/web/lib/routes';

test('company and invitation validation rejects malformed identity and elevated unknown roles', () => {
  const organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  expect(
    companyCreationInput.safeParse({
      legal_name: ' ',
      operating_name: 'Valid',
      request_id: organization_id,
    }).success,
  ).toBe(false);
  expect(
    companyCreationInput.safeParse({
      legal_name: 'Valid',
      operating_name: 'Valid',
      request_id: 'bad',
    }).success,
  ).toBe(false);
  expect(
    invitationInput.safeParse({ organization_id, email: 'person@example.test', role: 'superadmin' })
      .success,
  ).toBe(false);
  expect(
    invitationInput.parse({ organization_id, email: ' Person@Example.test ', role: 'viewer' })
      .email,
  ).toBe('person@example.test');
  expect(safeNext('/onboarding?organization=' + organization_id)).toContain('/onboarding');
  for (const path of [
    '//evil.test',
    '/onboarding\\evil.test',
    '/onboarding\r\nLocation: evil',
    'https://evil.test',
  ])
    expect(safeNext(path)).toBe('/dashboard');
});

for (const enabled of [false, true])
  test(`signup creation is explicit and server-gated (${enabled})`, async () => {
    const bundle = await build({
      entryPoints: ['apps/web/app/login/actions.ts'],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs',
      define: {
        'process.env.SITE_URL': '"https://example.test"',
        'process.env.BIDXCHANGE_SELF_SERVICE_ENABLED': JSON.stringify(String(enabled)),
      },
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
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
              contents:
                path === 'auth'
                  ? 'export async function createSupabaseServer(){return {auth:{signInWithOtp:async(value)=>{calls.push(value);return {error:null};}}};}'
                  : 'export function redirect(path){throw new Error(path);}',
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
    const calls: { options: { shouldCreateUser: boolean; emailRedirectTo: string } }[] = [];
    new Function('module', 'exports', 'calls', bundle.outputFiles[0].text)(
      compiled,
      compiled.exports,
      calls,
    );
    const form = new FormData();
    form.set('email', 'person@example.test');
    form.set('next', '/onboarding');
    await compiled.exports.requestSignIn({ message: '' }, form);
    expect(calls[0].options.shouldCreateUser).toBe(false);
    await compiled.exports.requestSignup({ message: '' }, form);
    expect(calls.length).toBe(enabled ? 2 : 1);
    if (enabled) {
      expect(calls[1].options.shouldCreateUser).toBe(true);
      expect(calls[1].options.emailRedirectTo).toBe(
        'https://example.test/auth/callback?next=%2Fonboarding',
      );
    }
  });

for (const width of [390, 1440])
  test(`company creation and invitation forms work with keyboard at ${width}px`, async ({
    page,
  }) => {
    const bundle = await build({
      entryPoints: ['tests/fixtures/onboarding-harness.tsx'],
      bundle: true,
      write: false,
      outdir: '.tmp/onboarding-harness',
      jsx: 'automatic',
      platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [
        {
          name: 'action-fixtures',
          setup(b) {
            b.onResolve({ filter: /app\/onboarding\/actions$/ }, () => ({
              path: 'actions',
              namespace: 'fixture',
            }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
              contents: ['createCompany', 'inviteMember', 'acceptInvitation', 'revokeInvitation']
                .map(
                  (name) =>
                    `export async function ${name}(state,form){window.fixtureCalls=(window.fixtureCalls||[]).concat([{action:'${name}',fields:Object.fromEntries(form)}]);return {success:true,message:'Synthetic ${name} saved'};}`,
                )
                .join('\n'),
            }));
          },
        },
      ],
    });
    await page.route('**/onboarding-harness', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
      }),
    );
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/onboarding-harness');
    await page.addStyleTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text,
    });
    await page.addScriptTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text,
    });
    await page.getByLabel('Legal company name').fill('Fictional Contractor LLC');
    await page.getByLabel('Operating name / DBA').fill('Fictional Contractor');
    await page.getByRole('button', { name: 'Create company workspace' }).focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('status').filter({ hasText: 'Synthetic createCompany saved' }),
    ).toBeVisible();
    await page.getByLabel('Colleague’s work email').fill('colleague@example.test');
    await expect(page.getByLabel('Workspace role')).toHaveValue('viewer');
    await page.getByLabel('Workspace role').selectOption('estimator');
    await page.getByRole('button', { name: 'Create invitation', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Synthetic inviteMember saved' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
    await page
      .getByRole('button', { name: 'Revoke invitation for colleague@example.test' })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Synthetic revokeInvitation saved' }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
