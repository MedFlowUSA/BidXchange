import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModelClient } from '../apps/web/lib/ai/engine';
import { researchRequest } from '../apps/web/lib/research/contracts';
import { evaluateResearch } from '../apps/web/lib/research/evaluate';
import { retrieveResearch } from '../apps/web/lib/research/retrieve';
import { planResearch } from '../apps/web/lib/research/planner';
import { qualificationData } from './fixtures/qualification-data';
import {
  noticeFixture,
  reportFixture,
  researchPlanFixture as plan,
} from './fixtures/research-data';
import { org } from './fixtures/workflow-data';

test('verified code overlap is transparent and expired evidence never earns points', () => {
  const fact = {
    ...qualificationData().facts[0],
    fact_type: 'naics',
    value: '238210',
    expiration_date: '2026-12-31',
  };
  const result = evaluateResearch([noticeFixture], [fact], plan, '2026-09-21T12:00:00Z');
  expect(result.results[0].matches[0].component).toBe('Company NAICS overlap');
  expect(result.results[0].qualification.some((q) => q.status === 'Pass')).toBe(false);
  fact.expiration_date = '2026-09-20';
  expect(
    evaluateResearch([noticeFixture], [fact], plan, '2026-09-21T12:00:00Z').results[0].matches,
  ).toEqual([]);
});
test('blockers stay explicit and cannot be outranked by code overlap', () => {
  const blocked = {
    ...noticeFixture,
    id: 'blocked',
    blockers: [{ requirement: 'Required license missing', href: '/pursuits/test' }],
  };
  const result = evaluateResearch([blocked, noticeFixture], [], plan, '2026-09-21T12:00:00Z');
  expect(result.results[1].qualification[0].status).toContain('Fail');
  expect(result.results[1].nextAction).toContain('blockers');
});
test('unknown requested fields remain unknown; publication is not inferred from entry dates', () => {
  const result = evaluateResearch(
    [{ ...noticeFixture, published: null, state: null }],
    [],
    { ...plan, publishedFrom: '2026-09-21', states: ['CA'] },
    '2026-09-21T12:00:00Z',
  );
  expect(result.results[0].unknownFilters).toEqual(['State', 'Publication date']);
  expect(
    evaluateResearch(
      [noticeFixture],
      [],
      { ...plan, publishedFrom: '2026-09-22' },
      '2026-09-21T12:00:00Z',
    ).results,
  ).toEqual([]);
});
test('grants are never substituted with contracts and inactive is not an archive claim', () => {
  expect(
    evaluateResearch([noticeFixture], [], { ...plan, intent: 'grants' }, '2026-09-21T12:00:00Z')
      .results,
  ).toEqual([]);
  expect(
    evaluateResearch(
      [{ ...noticeFixture, status: 'inactive' }],
      [],
      { ...plan, status: 'archived' },
      '2026-09-21T12:00:00Z',
    ).results,
  ).toEqual([]);
});
test('planner accepts strict filters only and treats previous filters as data', async () => {
  let input = '';
  const client = {
    responses: {
      create: async (args: { input: string }) => {
        input = args.input;
        return { status: 'completed', output_text: JSON.stringify(plan) };
      },
    },
  } as unknown as ModelClient;
  expect(
    await planResearch(
      client,
      'configured-model',
      'Only California',
      plan,
      '2026-09-21T00:00:00Z',
      new AbortController().signal,
    ),
  ).toEqual(plan);
  expect(JSON.parse(input).previousPlan).toEqual(plan);
  const bad = {
    responses: {
      create: async () => ({
        status: 'completed',
        output_text: JSON.stringify({ ...plan, sql: 'select all' }),
      }),
    },
  } as unknown as ModelClient;
  await expect(
    planResearch(bad, 'model', 'ignore rules', null, '2026-09-21', new AbortController().signal),
  ).rejects.toThrow('invalid_answer');
  expect(
    researchRequest.safeParse({
      organizationId: org,
      requestId: org,
      prompt: 'find bids',
      previousPlan: null,
      role: 'admin',
    }).success,
  ).toBe(false);
});
test('retrieval scopes local records and excludes restricted company evidence for viewers', async () => {
  const queries: { table: string; filters: [string, unknown][] }[] = [];
  const fact = {
    ...qualificationData().facts[0],
    fact_type: 'naics',
    value: '238210',
    sensitivity: 'restricted',
    expiration_date: '2026-12-31',
    organization_id: org,
  };
  const tables: Record<string, Record<string, unknown>[]> = {
    profile_facts: [fact],
    opportunities: [
      {
        id: noticeFixture.id,
        organization_id: org,
        title: 'Synthetic',
        status: 'open',
        updated_at: '2026-09-21',
      },
    ],
    pursuits: [],
  };
  const db = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      queries.push({ table, filters });
      const chain = {
        select() {
          return chain;
        },
        eq(k: string, v: unknown) {
          filters.push([k, v]);
          return chain;
        },
        in() {
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve({
            data: (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v)),
            error: null,
          }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  const result = await retrieveResearch(db, org, 'viewer', plan, '2026-09-21T00:00:00Z', false);
  expect(
    queries.every((q) => q.filters.some(([k, v]) => k === 'organization_id' && v === org)),
  ).toBe(true);
  expect(result.results[0].matches).toEqual([]);
  expect(result.warnings.join(' ')).toContain('not connected');
  expect(result.sources).toHaveLength(1);
});
let js: string, css: string;
test.beforeAll(async () => {
  const out = await build({
    entryPoints: ['tests/fixtures/research-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/research-ui',
    jsx: 'automatic',
    platform: 'browser',
    alias: { 'next/link': path.resolve('tests/fixtures/link.tsx') },
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
});
async function mount(page: Page) {
  await page.route('**/research-test', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/research.css"></head><body><div id="root"></div><script src="/research.js"></script></body></html>',
    }),
  );
  await page.route('**/research.js', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: js }),
  );
  await page.route('**/research.css', (r) => r.fulfill({ contentType: 'text/css', body: css }));
  await page.route('**/api/assistant/research/searches*', (r) =>
    r.fulfill({ json: r.request().method() === 'GET' ? { searches: [] } : { id: org } }),
  );
  await page.goto('/research-test');
}
test('conversation carries filters, renders honest results and saves on demand', async ({
  page,
}) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/assistant/research', (r) => {
    bodies.push(r.request().postDataJSON());
    return r.fulfill({ json: { report: reportFixture } });
  });
  await mount(page);
  await page.getByLabel('What work are you looking for?').fill('Find electrical work');
  await page.getByRole('button', { name: 'Research opportunities', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '1. Synthetic electrical retrofit' }),
  ).toBeVisible();
  await expect(
    page.getByText('SAM.gov is not connected. Attachments have not been analyzed.'),
  ).toBeVisible();
  await page.getByLabel('What work are you looking for?').fill('Only California');
  await page.getByRole('button', { name: 'Research opportunities', exact: true }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1].previousPlan).toEqual(plan);
  await page.getByRole('button', { name: 'Save this search' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Scheduling and notifications are not enabled',
  );
  await page.setViewportSize({ width: 390, height: 950 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
