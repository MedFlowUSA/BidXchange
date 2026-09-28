import { test, expect } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadTaskInbox } from '../apps/web/lib/task-inbox-records';
import { parseTaskInboxFilters, taskInboxHref } from '../apps/web/lib/task-inbox';

const org = '11111111-1111-4111-8111-111111111111',
  user = '22222222-2222-4222-8222-222222222222',
  foreign = '33333333-3333-4333-8333-333333333333',
  pursuit = '44444444-4444-4444-8444-444444444444';
const asOf = '2026-09-28T12:00:00Z';
type Row = Record<string, unknown>;
function database(tasks: Row[], fail?: string) {
  const calls: { table: string; scoped?: string; range?: number[]; ids?: unknown[] }[] = [];
  const tables: Record<string, Row[]> = {
    pursuit_tasks: tasks,
    pursuits: [
      { id: pursuit, organization_id: foreign, title: 'FOREIGN SECRET' },
      { id: pursuit, organization_id: org, title: 'Municipal retrofit' },
    ],
  };
  const db = {
    from(table: string) {
      const call: (typeof calls)[number] = { table };
      calls.push(call);
      const predicates: ((r: Row) => boolean)[] = [];
      const orders: { key: string; nullsFirst?: boolean }[] = [];
      let start = 0,
        end = Infinity;
      const chain = {
        select() {
          return chain;
        },
        eq(key: string, value: string) {
          if (key === 'organization_id') call.scoped = value;
          predicates.push((r) => r[key] === value);
          return chain;
        },
        neq(key: string, value: string) {
          predicates.push((r) => r[key] !== value);
          return chain;
        },
        is(key: string, value: null) {
          predicates.push((r) => (r[key] ?? null) === value);
          return chain;
        },
        lt(key: string, value: string) {
          predicates.push((r) => r[key] != null && Date.parse(String(r[key])) < Date.parse(value));
          return chain;
        },
        gte(key: string, value: string) {
          predicates.push((r) => r[key] != null && Date.parse(String(r[key])) >= Date.parse(value));
          return chain;
        },
        lte(key: string, value: string) {
          predicates.push((r) => r[key] != null && Date.parse(String(r[key])) <= Date.parse(value));
          return chain;
        },
        in(key: string, ids: string[]) {
          call.ids = ids;
          predicates.push((r) => ids.includes(String(r[key])));
          return chain;
        },
        order(key: string, options: { nullsFirst?: boolean }) {
          orders.push({ key, ...options });
          return chain;
        },
        range(a: number, b: number) {
          start = a;
          end = b;
          call.range = [a, b];
          return chain;
        },
        limit(n: number) {
          end = n - 1;
          return chain;
        },
        abortSignal(signal: AbortSignal) {
          expect(signal.aborted).toBe(false);
          return chain;
        },
        overrideTypes() {
          return chain;
        },
        then(resolve: (result: unknown) => unknown) {
          const rows = [...tables[table]]
            .filter((r) => predicates.every((p) => p(r)))
            .sort((a, b) => {
              for (const order of orders) {
                const x = a[order.key],
                  y = b[order.key];
                if (x == null && y != null) return order.nullsFirst ? -1 : 1;
                if (y == null && x != null) return order.nullsFirst ? 1 : -1;
                const delta = String(x ?? '').localeCompare(String(y ?? ''));
                if (delta) return delta;
              }
              return 0;
            })
            .slice(start, end + 1);
          return Promise.resolve({
            data: rows,
            error: table === fail ? { message: 'PRIVATE ERROR' } : null,
          }).then(resolve);
        },
      };
      return chain;
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}
const make = (n: number, extra: Row = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  organization_id: org,
  pursuit_id: pursuit,
  title: `Task ${n}`,
  status: 'todo',
  assigned_user_id: user,
  due_at: '2026-09-29T12:00:00Z',
  ...extra,
});

test('inbox queries beyond the workspace sample and filters before stable pagination', async () => {
  const tasks = [
    ...Array.from({ length: 550 }, (_, i) => make(i, { status: 'complete' })),
    ...Array.from({ length: 30 }, (_, i) => make(550 + i)),
    make(900, { organization_id: foreign, due_at: '2020-01-01T00:00:00Z' }),
    make(901, { due_at: null }),
  ];
  const { db, calls } = database(tasks);
  const first = await loadTaskInbox(db, org, user, { owner: 'all', timing: 'all', page: 0 }, asOf);
  expect(first.rows).toHaveLength(25);
  expect(first.rows[0].task.title).toBe('Task 550');
  expect(first.hasNext).toBe(true);
  const next = await loadTaskInbox(db, org, user, { owner: 'all', timing: 'all', page: 1 }, asOf);
  expect(next.rows).toHaveLength(6);
  expect(next.rows[0].task.title).toBe('Task 575');
  expect(next.rows.at(-1)?.task.due_at).toBeNull();
  expect(next.hasNext).toBe(false);
  expect(new Set([...first.rows, ...next.rows].map((r) => r.task.id)).size).toBe(31);
  expect(first.rows.every((r) => r.pursuitTitle === 'Municipal retrofit')).toBe(true);
  expect(calls).toHaveLength(4);
  expect(calls.every((c) => c.scoped === org)).toBe(true);
  expect(calls[0].range).toEqual([0, 25]);
  expect(calls[2].range).toEqual([25, 50]);
  expect(calls[1].ids).toEqual([pursuit]);
});

test('owner and deadline views exclude completed tasks and respect exact rolling time boundaries', async () => {
  const { db } = database([
    make(1, { due_at: '2026-09-28T11:59:59Z' }),
    make(2, { due_at: asOf }),
    make(3, { due_at: '2026-10-05T12:00:00Z' }),
    make(4, { due_at: '2026-10-05T12:00:01Z' }),
    make(5, { due_at: null, assigned_user_id: null }),
    make(6, { status: 'complete', due_at: null }),
    make(7, { assigned_user_id: foreign }),
  ]);
  const load = (
    owner: 'all' | 'mine' | 'unassigned',
    timing: 'all' | 'overdue' | 'week' | 'undated',
  ) => loadTaskInbox(db, org, user, { owner, timing, page: 0 }, asOf);
  expect((await load('mine', 'overdue')).rows.map((r) => r.task.title)).toEqual(['Task 1']);
  expect((await load('mine', 'week')).rows.map((r) => r.task.title)).toEqual(['Task 2', 'Task 3']);
  expect((await load('unassigned', 'undated')).rows.map((r) => r.task.title)).toEqual(['Task 5']);
  expect((await load('mine', 'undated')).rows).toEqual([]);
});

test('inbox failures are not empty-state success; malformed filters cannot issue a query', async () => {
  for (const fail of ['pursuit_tasks', 'pursuits']) {
    const { db } = database([make(1)], fail);
    const result = await loadTaskInbox(
      db,
      org,
      user,
      { owner: 'all', timing: 'all', page: 0 },
      asOf,
    );
    expect(result.error).toBe(true);
    expect(result.rows).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  }
  const { db, calls } = database([]);
  await expect(
    loadTaskInbox(db, 'invalid', user, { owner: 'all', timing: 'all', page: 0 }, asOf),
  ).rejects.toThrow('Invalid');
  expect(calls).toEqual([]);
  for (const value of ['-1', '1001', '1.2', '1e2', ['1'], ''])
    expect(parseTaskInboxFilters({ task_page: value }, 'viewer').success).toBe(false);
  expect(parseTaskInboxFilters({ task_owner: 'another-user' }, 'estimator').success).toBe(false);
  expect(parseTaskInboxFilters({}, 'estimator').data?.owner).toBe('mine');
  expect(parseTaskInboxFilters({}, 'organization_admin').data?.owner).toBe('all');
  expect(taskInboxHref(org, { owner: 'mine', timing: 'overdue', page: 1 })).toContain(
    'task_owner=mine&task_timing=overdue&task_page=1#today-tasks-heading',
  );
});
