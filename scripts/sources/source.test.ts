import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeSam,
  detectChange,
  samConfig,
  samConnector,
} from '../../apps/web/lib/sources/sam';
import { matchNotice, searchFilters } from '../../apps/web/lib/sources/contracts';
import { ingest, synchronize } from './sync';
import { localTestDatabase } from '../local-test-db.mjs';
const fixture = {
  noticeId: 'notice-1',
  title: 'Energy controls',
  postedDate: '2026-01-01',
  responseDeadLine: '2026-10-10T12:00:00-07:00',
  active: 'Yes',
  type: 'Solicitation',
  naicsCode: '238210',
  typeOfSetAside: 'SBA',
  resourceLinks: ['https://sam.gov/a'],
  uiLink: 'https://sam.gov/opp/notice-1/view',
};
const config = samConfig({
  SAM_GOV_API_KEY: 'synthetic-test-credential',
  BIDXCHANGE_SAM_SYNC_ENABLED: 'true',
  BIDXCHANGE_SAM_SYNC_PAGE_LIMIT: '1',
});
const from = new Date('2026-09-01'),
  to = new Date('2026-09-02');
test('normalization preserves unknown source dates and ambiguous deadline; strips credentials', () => {
  const s = normalizeSam({
    ...fixture,
    responseDeadLine: '2026-10-10 12:00',
    description: 'https://api.sam.gov/description?api_key=redacted&id=123',
  });
  assert.equal(s.notice.modified, null);
  assert.equal(s.notice.deadlineInstant, null);
  assert.equal(s.notice.published, '2026-01-01');
  assert.equal(
    normalizeSam({ ...fixture, responseDeadLine: '2026-02-30T12:00:00Z' }).notice.deadlineInstant,
    null,
  );
  assert.ok(!JSON.stringify(s).includes('redacted'));
  assert.throws(() =>
    normalizeSam({ ...fixture, title: 'synthetic-test-credential' }, 'synthetic-test-credential'),
  );
  assert.throws(() => normalizeSam({ title: 'missing identity' }));
  assert.throws(() => normalizeSam({ ...fixture, title: 'x'.repeat(66000) }));
});
test('material classifications preserve exact observed before and after', () => {
  const before = normalizeSam(fixture).notice;
  for (const fields of [
    { responseDeadLine: '2026-10-09T12:00:00-07:00' },
    { active: 'No' },
    { type: 'Cancellation' },
    { typeOfSetAside: '8A' },
    { resourceLinks: [] },
  ])
    assert.equal(
      detectChange(before, normalizeSam({ ...fixture, ...fields }).notice).severity,
      'critical',
    );
  assert.equal(detectChange(before, before).severity, 'none');
  assert.equal(
    detectChange(before, normalizeSam({ ...fixture, title: 'New title' }).notice).severity,
    'informational',
  );
});
test('deterministic filters expose missing information and never infer eligibility', () => {
  const n = normalizeSam(fixture).notice;
  assert.ok(
    matchNotice(
      n,
      searchFilters.parse({ naics: ['238210'], states: ['CA'] }),
      to,
    )?.missing.includes('State'),
  );
  assert.equal(matchNotice(n, searchFilters.parse({ excludedKeywords: ['controls'] }), to), null);
  assert.equal(matchNotice(n, searchFilters.parse({ naics: ['111111'] }), to), null);
  assert.throws(() => searchFilters.parse({ minimumDays: 20, maximumDays: 10 }));
});
test('configuration rejects uncontrolled pages/lookback and missing key', () => {
  assert.throws(() => samConfig({ BIDXCHANGE_SAM_SYNC_MAX_PAGES: '10000' }));
  assert.throws(() => samConfig({ BIDXCHANGE_SAM_SYNC_LOOKBACK_DAYS: '365' }));
  assert.throws(() => samConnector({ ...config, key: '' }, from, to));
  assert.throws(() => samConnector(config, from, new Date('2026-12-01')));
});
test('adapter uses documented page index and handles empty result', async () => {
  const offsets: string[] = [];
  const adapter = samConnector(config, from, to, async (input) => {
    offsets.push(new URL(String(input)).searchParams.get('offset')!);
    return Response.json({ totalRecords: 0, opportunitiesData: [] });
  });
  assert.deepEqual(await adapter.page(0), { records: [], total: 0 });
  await adapter.page(1);
  assert.deepEqual(offsets, ['0', '1']);
  await assert.rejects(adapter.page(99), /page_limit/);
});
for (const [status, code, calls] of [
  [401, 'invalid_key', 1],
  [403, 'invalid_key', 1],
  [429, 'rate_limited', 1],
  [503, 'unavailable', 3],
] as const)
  test(`adapter sanitizes ${status} with bounded retry`, async () => {
    let count = 0;
    const adapter = samConnector(config, from, to, async () => {
      count++;
      return new Response('credential should not be emitted', { status });
    });
    await assert.rejects(adapter.page(0), new RegExp(code));
    assert.equal(count, calls);
  });
test('timeout and malformed response are contained', async () => {
  let calls = 0;
  const timeout = samConnector(config, from, to, async () => {
    calls++;
    throw new DOMException('secret', 'TimeoutError');
  });
  await assert.rejects(timeout.page(0), /timeout/);
  assert.equal(calls, 3);
  const malformed = samConnector(config, from, to, async () =>
    Response.json({ opportunitiesData: 'bad' }),
  );
  await assert.rejects(malformed.page(0), /malformed_page/);
});
test('concurrent run is rejected before connector access', async () => {
  let called = false;
  await assert.rejects(
    synchronize(
      { query: async () => ({ rows: [{ locked: false }] }) },
      {
        id: 'sam.gov',
        page: async () => {
          called = true;
          return { records: [], total: 0 };
        },
      },
      { from, to, pages: 1, limit: 1 },
    ),
    /already_running/,
  );
  assert.equal(called, false);
});
test('tracked recheck sends notice identity and original publication range', async () => {
  let requested: URL | undefined;
  const adapter = samConnector(config, from, to, async (input) => {
    requested = new URL(String(input));
    return Response.json({ totalRecords: 1, opportunitiesData: [fixture] });
  });
  await adapter.refresh!('notice-1', '2026-01-01');
  assert.equal(requested?.searchParams.get('noticeid'), 'notice-1');
  assert.equal(requested?.searchParams.get('postedFrom'), '01/01/2026');
});
test('database ingestion, immutable versions, tenant RLS, conversion, and synchronization', async () => {
  const db = await localTestDatabase({ includeCompanySeed: false });
  try {
    await db.query(
      readFileSync('supabase/migrations/20260920001300_opportunity_sources.sql', 'utf8'),
    );
    const admin = '80000000-0000-4000-8000-000000000001',
      viewer = '80000000-0000-4000-8000-000000000002',
      other = '80000000-0000-4000-8000-000000000003';
    await db.query('insert into auth.users(id) values($1),($2),($3)', [admin, viewer, other]);
    const org = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Test','Test','source-test') returning id",
      )
    ).rows[0].id;
    const otherOrg = (
      await db.query(
        "insert into public.organizations(legal_name,operating_name,slug) values('Other','Other','source-other') returning id",
      )
    ).rows[0].id;
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin'),($1,$3,'viewer'),($4,$5,'organization_admin')",
      [org, admin, viewer, otherOrg, other],
    );
    async function as(user: string, sql: string, args: unknown[] = []) {
      await db.query('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      try {
        return await db.query(sql, args);
      } finally {
        await db.query('reset role');
        await db.query("select set_config('request.jwt.claim.sub','',false)");
      }
    }
    const searchSql =
      "select public.save_opportunity_search($1,null,null,'Reviewed energy filters',$2,true)";
    await assert.rejects(
      as(viewer, searchSql, [org, JSON.stringify(searchFilters.parse({ naics: ['238210'] }))]),
      /Access denied/,
    );
    await as(admin, searchSql, [org, JSON.stringify(searchFilters.parse({ naics: ['238210'] }))]);
    assert.equal((await as(other, 'select * from public.opportunity_searches')).rows.length, 0);
    const first = await ingest(db, normalizeSam(fixture));
    assert.equal(first.kind, 'created');
    assert.equal((await ingest(db, normalizeSam(fixture))).kind, 'unchanged');
    assert.equal(
      (await ingest(db, normalizeSam({ ...fixture, noticeId: 'notice-2' }))).kind,
      'created',
    );
    await db.query("update public.procurement_sources set enabled=true where id='sam.gov'");
    const result = await synchronize(
      db,
      { id: 'sam.gov', page: async () => ({ records: [fixture], total: 1 }) },
      { from, to, pages: 1, limit: 1 },
    );
    assert.equal(result.errorCode, null);
    const item = (
      await db.query('select * from public.source_inbox where record_id=$1', [first.id])
    ).rows[0];
    assert.ok(item);
    assert.equal((await as(other, 'select * from public.source_inbox')).rows.length, 0);
    assert.equal((await as(other, 'select * from public.source_records')).rows.length, 0);
    await assert.rejects(
      as(viewer, 'select raw_snapshot from public.source_record_versions'),
      /permission denied/,
    );
    await assert.rejects(
      as(admin, 'update public.procurement_sources set enabled=false'),
      /permission denied/,
    );
    await db.query('set role anon');
    await assert.rejects(db.query('select * from public.source_records'), /permission denied/);
    await db.query('reset role');
    const args = [
      org,
      item.id,
      item.updated_at,
      item.matched_version_id,
      'converted',
      'Human review',
      admin,
      true,
    ];
    const review = 'select public.review_source_item($1,$2,$3,$4,$5,$6,$7,$8) as id';
    await assert.rejects(as(viewer, review, args), /Access denied/);
    await assert.rejects(as(other, review, args), /Access denied/);
    await assert.rejects(as(admin, review, [...args.slice(0, 7), false]), /Confirmation/);
    await assert.rejects(as(admin, review, [...args.slice(0, 7), null]), /Confirmation/);
    await assert.rejects(
      as(admin, review, [org, item.id, null, null, 'converted', 'reason', admin, true]),
      /Source changed/,
    );
    await assert.rejects(
      as(admin, searchSql, [org, JSON.stringify({ naics: 'invalid' })]),
      /valid_filters/,
    );
    const converted = (await as(admin, review, args)).rows[0].id;
    assert.ok(converted);
    assert.equal((await as(admin, review, args)).rows[0].id, converted);
    assert.equal((await db.query('select * from public.pursuits')).rows.length, 0);
    assert.ok(
      (await as(admin, "select id from public.audit_events where entity_table='source_inbox'")).rows
        .length > 0,
    );
    assert.equal(
      (await as(viewer, "select id from public.audit_events where entity_table='source_inbox'"))
        .rows.length,
      0,
    );
    await ingest(db, normalizeSam({ ...fixture, responseDeadLine: '2026-10-01T12:00:00-07:00' }));
    assert.equal(
      (await db.query('select change_pending from public.source_inbox where id=$1', [item.id]))
        .rows[0].change_pending,
      true,
    );
    await assert.rejects(
      as(admin, review, [
        org,
        item.id,
        item.updated_at,
        item.matched_version_id,
        'saved',
        'reason',
        null,
        false,
      ]),
      /Source changed/,
    );
    await assert.rejects(
      db.query('update public.source_record_versions set severity=severity'),
      /immutable/,
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int as n from public.source_record_versions where record_id=$1',
          [first.id],
        )
      ).rows[0].n,
      2,
    );
    const partial = await synchronize(
      db,
      {
        id: 'sam.gov',
        page: async (offset) => {
          if (offset) throw new Error('provider secret');
          return { records: [fixture], total: 2 };
        },
      },
      { from, to, pages: 2, limit: 1 },
    );
    assert.equal(partial.errorCode, 'sync_failed');
    const limit = await synchronize(
      db,
      { id: 'sam.gov', page: async () => ({ records: [fixture], total: 2 }) },
      { from, to, pages: 1, limit: 1 },
    );
    assert.equal(limit.errorCode, 'page_limit');
  } finally {
    await db.end();
  }
});
