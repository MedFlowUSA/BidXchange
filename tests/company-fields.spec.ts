import { test, expect } from '@playwright/test';
import {
  companyTemplates,
  structuredErrors,
  structuredSummary,
} from '../apps/web/lib/company-fields';
import { companyRecordInput } from '../apps/web/lib/company-record-input';
import { responseAutofill } from '../apps/web/lib/response-autofill';
import { workflowData, pursuit, user } from './fixtures/workflow-data';
import type { Fact } from '../apps/web/lib/tenant-types';
import { build } from 'esbuild';
import path from 'node:path';

test('structured catalog validates formats, unknown keys, dates and record categories', () => {
  for (const key of Object.keys(companyTemplates)) expect(structuredErrors(key, {})).toEqual([]);
  for (const [kind, fields] of [
    ['__proto__', {}],
    ['bonding', { single_limit: '1,000', currency: 'USD' }],
    ['bonding', { single_limit: '100' }],
    ['project', { start: '2026-09-22', end: '2026-09-21' }],
    ['project', { start: '2026-02-30' }],
    ['business_email', { email: 'invalid' }],
    ['license', { password: 'secret' }],
  ] as const)
    expect(structuredErrors(kind, fields).length).toBeGreaterThan(0);
  expect(structuredSummary('business_phone', { number: '555-0100', extension: '22' })).toBe(
    'Phone number: 555-0100\nExtension: 22',
  );
  const input = {
    organization_id: '10000000-0000-4000-8000-000000000001',
    fact_id: '',
    updated_at: '',
    fact_type: 'identity',
    label: 'Company contact email',
    value: '',
    source_reference: 'Source',
    source_note: '',
    owner_user_id: user,
    effective_date: '',
    expiration_date: '',
    sensitivity: 'workspace',
    structured_kind: 'business_email',
    structured_fields: '{"email":"office@example.invalid"}',
  };
  expect(companyRecordInput.safeParse(input).success).toBe(true);
  expect(companyRecordInput.safeParse({ ...input, fact_type: 'bonding' }).success).toBe(false);
  expect(companyRecordInput.safeParse({ ...input, structured_fields: 'broken' }).success).toBe(
    false,
  );
});

test('autofill uses stable kinds, excludes duplicate and incomplete contacts, and preserves legacy evidence', () => {
  const data = workflowData();
  data.structuredProfilesEnabled = true;
  const email: Fact = {
    id: 'email',
    fact_type: 'identity',
    label: 'A label without email keywords',
    value: 'Business email address: office@example.invalid',
    structured_kind: 'business_email',
    structured_fields: { email: 'office@example.invalid' },
    verification_status: 'verified',
    source_reference: 'Company directory',
    source_note: null,
    verified_by: user,
    verified_at: '2026-09-20T00:00:00Z',
    expiration_date: null,
    sensitivity: 'workspace',
    updated_at: '2026-09-20T00:00:00Z',
  };
  data.facts = [email];
  expect(
    responseAutofill(data, pursuit, new Date(data.reviewAsOf)).gaps.some((g) =>
      g.startsWith('Business email:'),
    ),
  ).toBe(false);
  data.facts.push({
    ...email,
    id: 'duplicate',
    structured_fields: { email: 'another@example.invalid' },
  });
  const before = JSON.stringify(data);
  const conflicting = responseAutofill(data, pursuit, new Date(data.reviewAsOf));
  expect(conflicting.facts).toHaveLength(0);
  expect(conflicting.gaps.some((g) => g.includes('multiple current records'))).toBe(true);
  expect(JSON.stringify(data)).toBe(before);
  data.facts = [
    { ...email, structured_kind: 'mailing_address', structured_fields: { country: 'US' } },
  ];
  expect(responseAutofill(data, pursuit, new Date(data.reviewAsOf)).facts).toHaveLength(0);
  data.facts = [{ ...email, structured_kind: null, structured_fields: null }];
  expect(
    responseAutofill(data, pursuit, new Date(data.reviewAsOf)).gaps.some((g) =>
      g.includes('Legacy identity'),
    ),
  ).toBe(true);
  expect(data.facts).toHaveLength(1);
  data.facts = [{ ...email, sensitivity: 'restricted' }];
  expect(responseAutofill(data, pursuit, new Date(data.reviewAsOf)).facts).toHaveLength(0);
  data.facts = [{ ...email, verification_status: 'pending_verification' }];
  expect(responseAutofill(data, pursuit, new Date(data.reviewAsOf)).facts).toHaveLength(0);
});

for (const width of [390, 1440])
  test(`structured editor retains fields and submits explicit mapping at ${width}px`, async ({
    page,
  }) => {
    const bundle = await build({
      entryPoints: ['tests/fixtures/company-fields-harness.tsx'],
      bundle: true,
      write: false,
      outdir: '.tmp/company-fields-harness',
      jsx: 'automatic',
      platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [
        {
          name: 'actions',
          setup(b) {
            b.onResolve({ filter: /company-record-actions$/ }, () => ({
              path: path.resolve('tests/fixtures/company-fields-action.ts'),
            }));
          },
        },
      ],
    });
    await page.route('**/structured-harness', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
      }),
    );
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/structured-harness');
    await page.addStyleTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text,
    });
    await page.addScriptTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text,
    });
    await page.getByText('Business mailing address', { exact: true }).first().click();
    await page.getByLabel('Address line 1', { exact: true }).fill('100 Test Street');
    await page.getByLabel('City', { exact: true }).fill('Example');
    await page.getByLabel('Country', { exact: true }).fill('US');
    await page.getByLabel('Evidence reference', { exact: true }).fill('Synthetic directory');
    await page.getByText('Business mailing address', { exact: true }).first().click();
    await page.getByText('Business mailing address', { exact: true }).first().click();
    await expect(page.getByLabel('Address line 1', { exact: true })).toHaveValue('100 Test Street');
    await page.getByRole('button', { name: 'Save evidence record', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('mailing_address: 100 Test Street');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
