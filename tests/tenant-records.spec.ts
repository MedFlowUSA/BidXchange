import { test, expect } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadRecordContext, type TenantRecordSelection } from '../apps/web/lib/tenant-records';

const org = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const parent = '44444444-4444-4444-8444-444444444444';
type Row = Record<string, unknown>;
function database(tables: Record<string, Row[]>, failure?: string) {
  const queries: { table: string; filters: [string, unknown][]; single: boolean }[] = [];
  const db = {
    from(table: string) {
      return {
        select(fields: string) {
          const query = { table, filters: [] as [string, unknown][], single: false };
          queries.push(query);
          let limit = Infinity;
          let order: string | undefined;
          const result = () => {
            let rows = (tables[table] ?? []).filter((row) =>
              query.filters.every(([key, value]) =>
                Array.isArray(value) ? value.includes(row[key]) : row[key] === value,
              ),
            );
            if (order)
              rows = [...rows].sort((a, b) => String(a[order!]).localeCompare(String(b[order!])));
            rows = rows
              .slice(0, limit)
              .map((row) => Object.fromEntries(fields.split(',').map((key) => [key, row[key]])));
            return {
              data: query.single ? (rows[0] ?? null) : rows,
              error: table === failure ? { message: 'PRIVATE INTERNAL DETAIL' } : null,
            };
          };
          const chain = {
            overrideTypes() {
              return chain;
            },
            in(key: string, values: unknown[]) {
              query.filters.push([key, values]);
              return chain;
            },
            eq(key: string, value: unknown) {
              query.filters.push([key, value]);
              return chain;
            },
            order(key: string) {
              order = key;
              return chain;
            },
            limit(value: number) {
              limit = value;
              return chain;
            },
            maybeSingle() {
              query.single = true;
              return Promise.resolve(result());
            },
            then(resolve: (value: unknown) => unknown) {
              return Promise.resolve(result()).then(resolve);
            },
          };
          return chain;
        },
      };
    },
  };
  return { db: db as unknown as SupabaseClient, queries };
}
const unrelated = Array.from({ length: 501 }, (_, i) => ({
  id: `unrelated-${i}`,
  organization_id: org,
}));

test('direct opportunity survives the workspace 500-record sample and finds related pursuits', async () => {
  const source = database({
    opportunities: [...unrelated, { id, organization_id: org, title: 'Record 502' }],
    pursuits: [
      ...unrelated,
      { id: parent, organization_id: org, opportunity_id: id },
      { id: 'foreign', organization_id: foreign, opportunity_id: id },
    ],
  });
  const result = await loadRecordContext(source.db, org, { kind: 'opportunity', id });
  expect(result?.opportunities).toMatchObject([{ id, title: 'Record 502' }]);
  expect(result?.pursuits).toMatchObject([{ id: parent }]);
  expect(source.queries[0].single).toBe(true);
  expect(
    source.queries.every((q) => q.filters.some(([k, v]) => k === 'organization_id' && v === org)),
  ).toBe(true);
});

test('direct pursuit resolves its parent and tasks beyond unrelated workspace samples', async () => {
  const source = database({
    pursuits: [...unrelated, { id, organization_id: org, opportunity_id: parent }],
    opportunities: [...unrelated, { id: parent, organization_id: org }],
    pursuit_tasks: [
      ...unrelated,
      { id: 'own-task', organization_id: org, pursuit_id: id },
      { id: 'foreign-task', organization_id: foreign, pursuit_id: id },
    ],
    pursuit_requirements: [
      ...unrelated,
      { id: 'own-requirement', organization_id: org, pursuit_id: id, requirement: 'Bond required' },
      { id: 'foreign-requirement', organization_id: foreign, pursuit_id: id },
      { id: 'other-pursuit', organization_id: org, pursuit_id: parent },
    ],
  });
  const result = await loadRecordContext(source.db, org, { kind: 'pursuit', id });
  expect(result?.pursuits).toMatchObject([{ id }]);
  expect(result?.opportunities).toMatchObject([{ id: parent }]);
  expect(result?.tasks).toMatchObject([{ id: 'own-task' }]);
  expect(result?.requirements).toMatchObject([
    { id: 'own-requirement', requirement: 'Bond required' },
  ]);
  expect(source.queries.filter((q) => q.single)).toHaveLength(2);
  expect(
    source.queries.every((q) => q.filters.some(([k, v]) => k === 'organization_id' && v === org)),
  ).toBe(true);
});

test('foreign UUID and absent records have the same unavailable result', async () => {
  for (const rows of [[], [{ id, organization_id: foreign }]]) {
    const { db } = database({ opportunities: rows });
    expect(await loadRecordContext(db, org, { kind: 'opportunity', id })).toBeNull();
  }
});

test('a pursuit never resolves a foreign parent or retrieves its tasks', async () => {
  const source = database({
    pursuits: [{ id, organization_id: org, opportunity_id: parent }],
    opportunities: [{ id: parent, organization_id: foreign }],
  });
  expect(await loadRecordContext(source.db, org, { kind: 'pursuit', id })).toBeNull();
  expect(source.queries.some((q) => q.table === 'pursuit_tasks')).toBe(false);
});

test('invalid IDs and injected selection fields perform no database query', async () => {
  const source = database({});
  for (const selection of [
    { kind: 'opportunity', id: 'bad' },
    { kind: 'opportunity', id, organization_id: foreign },
    { kind: 'users', id },
  ])
    expect(await loadRecordContext(source.db, org, selection as TenantRecordSelection)).toBeNull();
  expect(await loadRecordContext(source.db, 'bad', { kind: 'opportunity', id })).toBeNull();
  expect(source.queries).toHaveLength(0);
});

test('database failures are not disguised as missing records or leaked to the UI', async () => {
  const { db } = database({}, 'opportunities');
  await expect(loadRecordContext(db, org, { kind: 'opportunity', id })).rejects.toThrow(
    'Record data could not be loaded. Please retry.',
  );
});

test('evidence reviews require activation, scope to loaded requirements and fail closed on read errors', async () => {
  const previous = process.env.BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED;
  const tables = {
    pursuits: [{ id, organization_id: org, opportunity_id: parent }],
    opportunities: [{ id: parent, organization_id: org }],
    pursuit_requirements: [{ id: 'req', organization_id: org, pursuit_id: id }],
    current_evidence_use_reviews: [
      { id: 'own-review', organization_id: org, requirement_id: 'req' },
      { id: 'other-pursuit', organization_id: org, requirement_id: 'other' },
      { id: 'foreign-review', organization_id: foreign, requirement_id: 'req' },
    ],
  };
  try {
    process.env.BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED = 'false';
    const disabled = database(tables);
    await loadRecordContext(disabled.db, org, { kind: 'pursuit', id });
    expect(disabled.queries.some((q) => q.table === 'current_evidence_use_reviews')).toBe(false);
    process.env.BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED = 'true';
    expect(
      (await loadRecordContext(database(tables).db, org, { kind: 'pursuit', id }))?.evidenceReviews,
    ).toMatchObject([{ id: 'own-review' }]);
    await expect(
      loadRecordContext(database(tables, 'current_evidence_use_reviews').db, org, {
        kind: 'pursuit',
        id,
      }),
    ).rejects.toThrow('Evidence reviews could not be loaded. Please retry.');
  } finally {
    if (previous === undefined) delete process.env.BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED;
    else process.env.BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED = previous;
  }
});
