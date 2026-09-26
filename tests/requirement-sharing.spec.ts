import { test, expect } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSharedRequirement, sharingContext } from '../apps/web/lib/ai/requirement-sharing';
import { requestSchema, type Role } from '../apps/web/lib/ai/contracts';
import { readConversation, sealConversation } from '../apps/web/lib/ai/conversation';
const org = '11111111-1111-4111-8111-111111111111';
const id = '55555555-5555-4555-8555-555555555555';
const context = { kind: 'pursuit' as const, id: '22222222-2222-4222-8222-222222222222' };
const shared = { id, updatedAt: '2026-09-25T00:00:00+00:00', consent: true as const };
function fixture(overrides: Record<string, unknown> = {}) {
  const row = {
    id,
    organization_id: org,
    pursuit_id: context.id,
    archived_at: null,
    requirement: 'All subcontractors must supply the requested registration evidence.',
    updated_at: shared.updatedAt,
    ...overrides,
  };
  const filters: Record<string, unknown> = {};
  let reads = 0;
  let fields = '';
  const q = {
    select(s: string) {
      fields = s;
      return q;
    },
    eq(k: string, v: unknown) {
      filters[k] = v;
      return q;
    },
    is(k: string, v: unknown) {
      filters[k] = v;
      return q;
    },
    async maybeSingle() {
      reads++;
      return {
        data: Object.entries(filters).every(([k, v]) => row[k as keyof typeof row] === v)
          ? row
          : null,
        error: null,
      };
    },
  };
  return {
    db: { from: () => q } as unknown as SupabaseClient,
    filters,
    get reads() {
      return reads;
    },
    get fields() {
      return fields;
    },
  };
}
test('explicit requirement sharing is scoped, bounded and version checked', async () => {
  const f = fixture({ requirement: 'A'.repeat(1001) });
  const result = await readSharedRequirement(
    f.db,
    org,
    'capture_manager',
    context,
    'workspace',
    shared,
  );
  expect(result?.text).toHaveLength(1000);
  expect(result?.truncated).toBe(true);
  expect(f.filters).toEqual({
    organization_id: org,
    pursuit_id: context.id,
    id,
    archived_at: null,
  });
  expect(f.fields).toBe('id,requirement,updated_at');
  for (const change of [
    { organization_id: 'foreign' },
    { pursuit_id: 'foreign' },
    { archived_at: '2026-09-26' },
  ])
    await expect(
      readSharedRequirement(
        fixture(change).db,
        org,
        'organization_admin',
        context,
        'workspace',
        shared,
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });
  await expect(
    readSharedRequirement(
      fixture({ updated_at: '2026-09-26' }).db,
      org,
      'organization_admin',
      context,
      'workspace',
      shared,
    ),
  ).rejects.toMatchObject({ code: 'conversation_changed' });
});
test('general mode, unauthorized roles and missing consent never read clause text', async () => {
  const f = fixture();
  expect(await readSharedRequirement(f.db, org, 'viewer', context, 'workspace')).toBeUndefined();
  for (const role of ['viewer', 'estimator', 'contributor', 'executive_approver'] as Role[])
    await expect(
      readSharedRequirement(f.db, org, role, context, 'workspace', shared),
    ).rejects.toMatchObject({ code: 'forbidden' });
  await expect(
    readSharedRequirement(f.db, org, 'organization_admin', context, 'general', shared),
  ).rejects.toMatchObject({ code: 'forbidden' });
  await expect(
    readSharedRequirement(f.db, org, 'organization_admin', null, 'workspace', shared),
  ).rejects.toMatchObject({ code: 'forbidden' });
  expect(f.reads).toBe(0);
  expect(
    requestSchema.safeParse({
      organizationId: org,
      requestId: id,
      prompt: 'Explain',
      context,
      sharedRequirement: { ...shared, consent: false },
    }).success,
  ).toBe(false);
});
test('removing or changing a shared requirement cannot replay the old conversation', () => {
  const scope = {
    user: 'synthetic',
    organization: org,
    role: 'organization_admin',
    mode: 'workspace',
    context: sharingContext(context, shared),
  };
  const token = sealConversation(
    readConversation(undefined, 'synthetic', scope),
    'synthetic',
    'Explain',
    { answer: [], risks: [], nextAction: '', citations: [], evidence: [], notice: '' },
    [],
  );
  expect(readConversation(token, 'synthetic', scope).scope).toEqual(scope);
  for (const changed of [
    sharingContext(context),
    sharingContext(context, { ...shared, updatedAt: 'new-version' }),
  ])
    expect(() => readConversation(token, 'synthetic', { ...scope, context: changed })).toThrow();
});
