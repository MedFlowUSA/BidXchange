import { test, expect } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  samRequest,
  defaultSamFilters,
  validateSamFilters,
} from '../apps/web/lib/research/sam-contracts';
import {
  companySamCodes,
  prepareSamFilters,
  readSamCompany,
  searchSam,
} from '../apps/web/lib/research/sam-search';
import { samHandlers, type SamDependencies } from '../apps/web/lib/research/sam-handler';
import type { Fact } from '../apps/web/lib/tenant-types';
import type { ResearchPlan } from '../apps/web/lib/research/contracts';
import { AiError, type Role } from '../apps/web/lib/ai/contracts';

const org = '11111111-1111-4111-8111-111111111111';
const user = '22222222-2222-4222-8222-222222222222';
const now = new Date().toISOString();
const filters = { ...defaultSamFilters(), title: 'electrical', state: 'CA' };
const fact: Fact = {
  id: user,
  fact_type: 'naics',
  label: 'Trade code',
  value: '238210',
  sensitivity: 'workspace',
  verification_status: 'verified',
  source_reference: 'Human supplied',
  source_note: null,
  verified_by: user,
  verified_at: now,
  expiration_date: null,
  updated_at: now,
};
const plan: ResearchPlan = {
  keywords: ['electrical'],
  naics: [],
  psc: [],
  agencies: [],
  states: ['CA'],
  setAsides: [],
  noticeTypes: [],
  publishedFrom: null,
  publishedTo: null,
  deadlineFrom: null,
  deadlineTo: null,
  status: 'active',
  source: 'sam.gov',
  intent: 'discover',
  radiusMiles: null,
  origin: null,
  limit: 5,
};
const rawNotice = {
  noticeId: 'notice-1',
  title: 'Electrical retrofit',
  postedDate: '2026-09-01',
  active: 'Yes',
  type: 'Solicitation',
  naicsCode: '238210',
  uiLink: 'https://sam.gov/opp/notice-1/view',
  responseDeadLine: '2026-10-01T15:00:00',
  placeOfPerformance: { state: { code: 'CA' } },
};
test('SAM filters enforce exact shape, consent, one-month past windows and public search input', () => {
  expect(validateSamFilters(filters)).toEqual(filters);
  for (const change of [
    { title: '', naics: '' },
    { naics: '238210 OR 999999' },
    { state: 'California' },
    { postedFrom: '2020-01-01' },
    { postedTo: '2999-01-01' },
    { key: 'not-allowed' },
  ])
    expect(() => validateSamFilters({ ...filters, ...change })).toThrow();
  const body = { action: 'search', organizationId: org, requestId: user, filters, consent: true };
  expect(samRequest.safeParse(body).success).toBe(true);
  for (const change of [
    { consent: false },
    { role: 'organization_admin' },
    { companyFacts: [fact] },
    { filters: { ...filters, url: 'https://other.invalid' } },
  ])
    expect(samRequest.safeParse({ ...body, ...change }).success).toBe(false);
});
test('company codes require current attestation and role access; planner does not invent company codes', () => {
  expect(companySamCodes([fact], 'viewer', now)).toEqual([
    { code: '238210', factId: user, label: 'Trade code' },
  ]);
  for (const change of [
    { sensitivity: 'restricted' },
    { sensitivity: 'unknown' },
    { verified_by: null },
    { verification_status: 'unverified' },
    { expiration_date: '2020-01-01' },
    { verified_at: '2020-01-01T00:00:00Z' },
  ])
    expect(companySamCodes([{ ...fact, ...change }], 'viewer', now)).toEqual([]);
  const prepared = prepareSamFilters(
    { ...plan, keywords: ['electrical', 'solar'], radiusMiles: 50 },
    new Date(),
  );
  expect(prepared.filters.naics).toBe('');
  expect(prepared.filters.title).toBe('electrical');
  expect(prepared.warnings.join(' ')).toContain('Only the first');
  expect(prepared.warnings.join(' ')).toContain('not applied');
  expect(prepareSamFilters({ ...plan, intent: 'grants' }, new Date()).unsupported).toBe(true);
});
test('official search sends reviewed filters only and preserves partial/unknown source facts', async () => {
  const key = 'synthetic-provider-secret';
  let calls = 0;
  const report = await searchSam(
    filters,
    key,
    companySamCodes([fact], 'viewer', now),
    new AbortController().signal,
    async (input, init) => {
      calls++;
      const url = new URL(String(input));
      expect(url.origin + url.pathname).toBe('https://api.sam.gov/opportunities/v2/search');
      expect([...url.searchParams.keys()].sort()).toEqual(
        ['api_key', 'limit', 'offset', 'postedFrom', 'postedTo', 'state', 'title'].sort(),
      );
      expect(url.searchParams.get('limit')).toBe('10');
      expect(url.searchParams.get('title')).toBe('electrical');
      expect(init?.redirect).toBe('error');
      expect(init?.cache).toBe('no-store');
      expect(init?.body).toBeUndefined();
      return Response.json({ opportunitiesData: [rawNotice], totalRecords: 23 });
    },
  );
  expect(calls).toBe(1);
  expect(report.partial).toBe(true);
  expect(report.results[0].deadlineInstant).toBeNull();
  expect(report.results[0].deadline).toBe(rawNotice.responseDeadLine);
  expect(report.results[0].companyEvidence[0].code).toBe('238210');
  expect(JSON.stringify(report)).not.toContain(key);
});
test('SAM provider errors and malformed/credential-bearing records fail closed without retries', async () => {
  for (const response of [
    new Response('', { status: 429 }),
    new Response('', { status: 403 }),
    new Response('', { status: 500 }),
    Response.json({ opportunitiesData: {}, totalRecords: 1 }),
    Response.json({
      opportunitiesData: [{ ...rawNotice, title: 'synthetic-key' }],
      totalRecords: 1,
    }),
  ]) {
    let calls = 0;
    await expect(
      searchSam(filters, 'synthetic-key', [], new AbortController().signal, async () => {
        calls++;
        return response;
      }),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  }
});

function fixture(
  options: {
    enabled?: boolean;
    key?: boolean;
    reserved?: string;
    role?: Role;
    revokeAt?: number;
    factError?: boolean;
    auditError?: boolean;
  } = {},
) {
  const filtersSeen: [string, string, unknown][] = [];
  const audits: unknown[] = [];
  let authorizations = 0,
    modelCalls = 0,
    providerCalls = 0,
    reserves = 0;
  const db = {
    from(table: string) {
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filtersSeen.push([table, column, value]);
          return query;
        },
        in: () => query,
        order: () => query,
        maybeSingle: async () => ({ data: { enabled: options.enabled !== false }, error: null }),
        limit: async () => ({ data: [fact], error: options.factError ? {} : null }),
        insert: async (value: unknown) => {
          audits.push(value);
          return { error: options.auditError ? {} : null };
        },
      };
      return query;
    },
    rpc: async () => {
      reserves++;
      return { data: options.reserved ?? 'reserved', error: null };
    },
  } as unknown as SupabaseClient;
  const deps: SamDependencies = {
    authorize: async (id) => {
      authorizations++;
      if (id !== org || authorizations === options.revokeAt) throw new AiError('forbidden', 403);
      return { db, user: { id: user }, role: options.role ?? 'viewer' };
    },
    sameOrigin: (r) => {
      if (r.headers.get('origin') !== 'https://app.invalid') throw new AiError('forbidden', 403);
    },
    config: () => ({ key: 'synthetic-model-secret', orgLimit: 50, userLimit: 10 }),
    samKey: () => (options.key === false ? null : 'synthetic-provider-secret'),
    plan: async (prompt) => {
      modelCalls++;
      expect(prompt).toBe('Find electrical bids');
      return plan;
    },
    search: async (sent, _key, codes) => {
      providerCalls++;
      expect(codes).toEqual([]);
      return {
        filters: sent,
        checkedAt: now,
        total: 1,
        returned: 1,
        partial: false,
        warnings: [],
        canSave: false,
        defaultTimezone: 'UTC',
        results: [
          {
            id: 'notice-1',
            title: 'Electrical retrofit',
            agency: null,
            solicitationNumber: null,
            url: rawNotice.uiLink,
            published: null,
            deadline: null,
            deadlineInstant: null,
            naics: '238210',
            state: 'CA',
            status: 'active',
            noticeType: null,
            companyEvidence: [],
          },
        ],
      };
    },
  };
  return {
    handlers: samHandlers(deps),
    db,
    filtersSeen,
    audits,
    counts: () => ({ authorizations, modelCalls, providerCalls, reserves }),
  };
}
function post(action: 'prepare' | 'search', changes = {}, origin = 'https://app.invalid') {
  return new Request('https://app.invalid/api/assistant/research/sam', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationId: org,
      requestId: user,
      action,
      ...(action === 'prepare' ? { prompt: 'Find electrical bids' } : { filters, consent: true }),
      ...changes,
    }),
  });
}
test('SAM preparation reads only scoped company code records and makes no source request', async () => {
  const f = fixture({ key: false });
  const response = await f.handlers.POST(post('prepare'));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.available).toBe(false);
  expect(data.company.codes[0].code).toBe('238210');
  expect(f.counts().providerCalls).toBe(0);
  expect(f.counts().modelCalls).toBe(1);
  expect(f.filtersSeen).toContainEqual(['profile_facts', 'organization_id', org]);
  expect(JSON.stringify(f.audits)).not.toContain('Find electrical bids');
  expect(JSON.stringify(f.audits)).not.toContain('238210');
});
test('live research enforces tenant, origin, activation, consent, quotas and connection before provider calls', async () => {
  for (const [options, request, status] of [
    [{}, post('search', { organizationId: '33333333-3333-4333-8333-333333333333' }), 403],
    [{}, post('search', {}, 'https://foreign.invalid'), 403],
    [{ enabled: false }, post('search'), 503],
    [{}, post('search', { consent: false }), 400],
    [{ reserved: 'rate_limited' }, post('search'), 429],
    [{ key: false }, post('search'), 503],
  ] as const) {
    const f = fixture(options);
    expect((await f.handlers.POST(request)).status).toBe(status);
    expect(f.counts().providerCalls).toBe(0);
    expect(f.counts().modelCalls).toBe(0);
  }
});
test('live search reauthorizes, returns only permitted current code comparison and gates saving', async () => {
  for (const role of ['viewer', 'estimator', 'organization_admin', 'capture_manager'] as const) {
    const f = fixture({ role });
    const response = await f.handlers.POST(post('search'));
    expect(response.status).toBe(200);
    const { report } = await response.json();
    expect(report.canSave).toBe(['organization_admin', 'capture_manager'].includes(role));
    expect(report.results[0].companyEvidence[0].code).toBe('238210');
    expect(f.counts().modelCalls).toBe(0);
    expect(f.counts().providerCalls).toBe(1);
    expect(f.audits).toHaveLength(1);
  }
  for (const options of [{ revokeAt: 3 }, { factError: true }, { auditError: true }]) {
    const f = fixture(options);
    const response = await f.handlers.POST(post('search'));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await response.text()).not.toContain('Electrical retrofit');
  }
});
test('company reads fail closed instead of interpreting query failure as no company evidence', async () => {
  const f = fixture({ factError: true });
  await expect(readSamCompany(f.db, org, 'viewer', now)).rejects.toThrow();
});
