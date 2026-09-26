import { test, expect } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSharedRequirements, sharingContext } from '../apps/web/lib/ai/requirement-sharing';
import {
  requestSchema,
  type Evidence,
  type Role,
  type SharedRequirement,
} from '../apps/web/lib/ai/contracts';
import {
  validateRequirementReview,
  presentRequirementReview,
} from '../apps/web/lib/ai/requirement-review';
import { readConversation, sealConversation } from '../apps/web/lib/ai/conversation';
const org = '11111111-1111-4111-8111-111111111111';
const context = { kind: 'pursuit' as const, id: '22222222-2222-4222-8222-222222222222' };
const selections = [3, 4].map((n) => ({
  id: `${n}3333333-3333-4333-8333-333333333333`,
  updatedAt: '2026-09-25',
  consent: true as const,
}));
function fixture(overrides: Record<string, unknown> = {}, items = selections) {
  let reads = 0;
  let fields = '';
  const rows = items.map((s) => ({
    id: s.id,
    organization_id: org,
    pursuit_id: context.id,
    archived_at: null,
    requirement: 'Synthetic clause',
    updated_at: s.updatedAt,
    ...overrides,
  }));
  let filtered = rows;
  const q = {
    select(value: string) {
      fields = value;
      return q;
    },
    eq(k: string, v: unknown) {
      filtered = filtered.filter((r) => r[k as keyof typeof r] === v);
      return q;
    },
    is(k: string, v: unknown) {
      return q.eq(k, v);
    },
    in(k: string, values: unknown[]) {
      filtered = filtered.filter((r) => values.includes(r[k as keyof typeof r]));
      return q;
    },
    then(resolve: (value: unknown) => unknown) {
      reads++;
      return Promise.resolve(resolve({ data: filtered, error: null }));
    },
  };
  return {
    db: { from: () => q } as unknown as SupabaseClient,
    get reads() {
      return reads;
    },
    get fields() {
      return fields;
    },
  };
}
test('batch disclosure uses one tenant-scoped read, bounds text and rejects stale, foreign and archived selections', async () => {
  const f = fixture({ requirement: 'A'.repeat(4500) });
  const result = await readSharedRequirements(
    f.db,
    org,
    'organization_admin',
    context,
    'workspace',
    selections,
  );
  expect(f.reads).toBe(1);
  expect(f.fields).toBe('id,requirement,updated_at');
  expect(result?.map((r) => [r.text.length, r.truncated])).toEqual([
    [4000, true],
    [4000, true],
  ]);
  for (const change of [
    { organization_id: 'foreign' },
    { pursuit_id: 'foreign' },
    { archived_at: 'date' },
  ])
    await expect(
      readSharedRequirements(
        fixture(change).db,
        org,
        'organization_admin',
        context,
        'workspace',
        selections,
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });
  await expect(
    readSharedRequirements(
      fixture({ updated_at: 'new' }).db,
      org,
      'organization_admin',
      context,
      'workspace',
      selections,
    ),
  ).rejects.toMatchObject({ code: 'conversation_changed' });
});

test('review rejects combined excerpts beyond the total sharing budget', async () => {
  const items = Array.from({ length: 6 }, (_, i) => ({
    ...selections[0],
    id: `${i + 1}3333333-3333-4333-8333-333333333333`,
  }));
  await expect(
    readSharedRequirements(
      fixture({ requirement: 'A'.repeat(4001) }, items).db,
      org,
      'organization_admin',
      context,
      'workspace',
      items,
    ),
  ).rejects.toMatchObject({ code: 'invalid_request' });
});
test('review sharing rejects general mode, unauthorized roles, duplicates, absent consent and excessive selections before reading text', async () => {
  const f = fixture();
  for (const role of ['viewer', 'estimator', 'contributor', 'executive_approver'] as Role[])
    await expect(
      readSharedRequirements(f.db, org, role, context, 'workspace', selections),
    ).rejects.toMatchObject({ code: 'forbidden' });
  await expect(
    readSharedRequirements(f.db, org, 'organization_admin', context, 'general', selections),
  ).rejects.toMatchObject({ code: 'forbidden' });
  await expect(
    readSharedRequirements(f.db, org, 'organization_admin', null, 'workspace', selections),
  ).rejects.toMatchObject({ code: 'forbidden' });
  for (const selection of [
    [],
    [selections[0], selections[0]],
    Array(9).fill(selections[0]),
    [{ ...selections[0], consent: false }],
  ])
    await expect(
      readSharedRequirements(
        f.db,
        org,
        'organization_admin',
        context,
        'workspace',
        selection as SharedRequirement[],
      ),
    ).rejects.toMatchObject({ code: 'invalid_request' });
  expect(f.reads).toBe(0);
  expect(
    requestSchema.safeParse({
      organizationId: org,
      requestId: org,
      prompt: 'Review',
      context,
      sharedRequirement: selections[0],
      sharedRequirements: selections,
    }).success,
  ).toBe(false);
});
test('selected reviews cannot replay context after selection or version changes; reorder is harmless', () => {
  const scope = {
    user: 'a',
    organization: org,
    role: 'organization_admin',
    mode: 'workspace',
    context: sharingContext(context, selections),
  };
  const token = sealConversation(
    readConversation(undefined, 'test', scope),
    'test',
    'Review',
    { answer: [], risks: [], nextAction: '', citations: [], evidence: [], notice: '' },
    [],
  );
  expect(
    readConversation(token, 'test', {
      ...scope,
      context: sharingContext(context, [...selections].reverse()),
    }).scope,
  ).toEqual(scope);
  for (const selection of [
    undefined,
    [selections[0]],
    [{ ...selections[0], updatedAt: 'new' }, selections[1]],
  ])
    expect(() =>
      readConversation(token, 'test', { ...scope, context: sharingContext(context, selection) }),
    ).toThrow();
});

test('selected review follow-ups retain more source fingerprints without unbounding ordinary chat', () => {
  const scope = {
    user: 'a',
    organization: org,
    role: 'organization_admin',
    mode: 'workspace',
    context: sharingContext(context, selections),
  };
  const records = Array.from(
    { length: 24 },
    (_, i) =>
      ({
        citation: { type: 'fact', id: String(i), key: `fact:${i}` },
        fields: { value: 'Synthetic' },
      }) as Evidence,
  );
  const answer = {
    answer: [],
    risks: [],
    nextAction: '',
    citations: [],
    evidence: [],
    notice: '',
    requirementReview: [],
  };
  const token = sealConversation(
    readConversation(undefined, 'test', scope),
    'test',
    'Review',
    answer,
    records,
  );
  expect(readConversation(token, 'test', scope).refs).toHaveLength(24);
  expect(
    sealConversation(
      readConversation(undefined, 'test', scope),
      'test',
      'Ordinary',
      { ...answer, requirementReview: undefined },
      records,
    ),
  ).toBeUndefined();
});
test('review coverage must be exact and company comparisons can cite only retrieved company facts', () => {
  const excerpts = selections.map((s) => ({ ...s, text: 'Clause', truncated: false }));
  const evidence = new Map(
    excerpts.map((s) => [`requirement:${s.id}`, { citation: { type: 'requirement' } } as Evidence]),
  );
  evidence.set('fact:a', { citation: { type: 'fact' } } as Evidence);
  evidence.set('task:b', { citation: { type: 'task' } } as Evidence);
  const rows = selections.map((s) => ({
    requirementKey: `requirement:${s.id}`,
    meaning: 'Meaning',
    assessment: 'records_found' as const,
    comparison: 'Related record, review required.',
    companySources: ['fact:a'],
    nextStep: 'Review',
  }));
  expect(validateRequirementReview([...rows].reverse(), excerpts, evidence)).toEqual(rows);
  for (const invalid of [
    rows.slice(0, 1),
    [rows[0], rows[0]],
    [{ ...rows[0], requirementKey: 'requirement:foreign' }, rows[1]],
    [{ ...rows[0], companySources: ['fact:invented'] }, rows[1]],
    [{ ...rows[0], companySources: ['task:b'] }, rows[1]],
    [{ ...rows[0], companySources: [] }, rows[1]],
  ])
    expect(() => validateRequirementReview(invalid, excerpts, evidence)).toThrow();
});

test('review presentation removes internal requirement IDs and status labels without altering evidence or quotations', () => {
  const excerpts = selections.map((s) => ({
    ...s,
    text: `Literal source ${s.id} check_date_missing_or_invalid`,
    truncated: false,
  }));
  const key = `requirement:${selections[0].id}`;
  const answer = {
    answer: [
      { text: `Requirement ${selections[0].id}: check_date_missing_or_invalid`, sources: [key] },
    ],
    risks: ['pending_verification'],
    nextAction: '',
    citations: [],
    evidence: [],
    notice: '',
    sharedRequirements: excerpts,
    requirementReview: [
      {
        requirementKey: key,
        meaning: 'Provide records',
        assessment: 'needs_evidence' as const,
        comparison: 'check_date_missing_or_invalid',
        companySources: [],
        nextStep: 'Review',
      },
    ],
  };
  const result = presentRequirementReview(answer, excerpts);
  expect(result.answer[0].text).toBe('Requirement 1: last-checked date missing or invalid');
  expect(result.answer[0].sources).toEqual([key]);
  expect(result.sharedRequirements).toEqual(excerpts);
  expect(result.requirementReview![0].requirementKey).toBe(key);
  expect(result.requirementReview![0].comparison).toBe('last-checked date missing or invalid');
  expect(answer.answer[0].text).toContain(selections[0].id);
});
