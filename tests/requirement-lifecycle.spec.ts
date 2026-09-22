import { test, expect } from '@playwright/test';
import { requirementLifecycleInput } from '../apps/web/lib/requirement-lifecycle';

const base = {
  organization_id: '11111111-1111-4111-8111-111111111111',
  pursuit_id: '22222222-2222-4222-8222-222222222222',
  requirement_id: '33333333-3333-4333-8333-333333333333',
  expected_source: '2026-09-22T10:00:00Z', operation: 'archive', reason: 'Duplicate training row',
  target_id: '', expected_target: '', merged_text: '', acknowledged: 'on',
};
test('corrections require explicit acknowledgment, attribution and a current version', () => {
  expect(requirementLifecycleInput.safeParse(base).success).toBe(true);
  expect(requirementLifecycleInput.safeParse({ ...base, operation: 'restore' }).success).toBe(true);
  for (const changed of [{ acknowledged: '' }, { reason: '' }, { expected_source: '' }, { operation: 'delete' }, { organization_id: 'other' }, { reason: 'x'.repeat(2001) }])
    expect(requirementLifecycleInput.safeParse({ ...base, ...changed }).success).toBe(false);
});
test('merge needs a distinct target, its version and reviewed wording', () => {
  const merge = { ...base, operation: 'merge', target_id: '44444444-4444-4444-8444-444444444444', expected_target: base.expected_source, merged_text: 'Combined wording' };
  expect(requirementLifecycleInput.safeParse(merge).success).toBe(true);
  for (const changed of [{ target_id: base.requirement_id }, { expected_target: '' }, { merged_text: '' }, { merged_text: 'x'.repeat(4001) }, { operation: 'restore' }])
    expect(requirementLifecycleInput.safeParse({ ...merge, ...changed }).success).toBe(false);
});
