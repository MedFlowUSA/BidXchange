import { test, expect } from '@playwright/test';
import { evidenceStressTest } from '../apps/web/lib/evidence-stress-test';
import type { Fact } from '../apps/web/lib/tenant-types';

const fact = (id: string) => ({ id, label: id }) as Fact;
const requirement = (id: string, pursuit_id = 'p') => ({
  id,
  pursuit_id,
  requirement: id,
  citation: 'Section 1',
  status: 'needs_review',
  owner_user_id: null,
  updated_at: '2026-09-20T00:00:00Z',
});
const review = (
  requirement_id: string,
  fact_id: string,
  approval_current: boolean | null = true,
) => ({
  id: `${requirement_id}-${fact_id}`,
  requirement_id,
  fact_id,
  approval_current,
  applicability: 'applicable',
  proposal_use: 'approved',
  reason: '',
  reviewed_by: 'reviewer',
  reviewed_at: '2026-09-20T00:00:00Z',
});
const data = () => ({
  facts: [fact('license'), fact('reference')],
  requirements: [requirement('one'), requirement('two'), requirement('foreign', 'other')],
  evidenceReviewsEnabled: true,
  evidenceReviews: [
    review('one', 'license'),
    review('one', 'reference'),
    review('two', 'license'),
    review('foreign', 'license'),
  ],
});

test('combined evidence loss reveals shared dependencies and distinct alternatives without mutation', () => {
  const input = data(),
    original = JSON.stringify(input);
  const single = evidenceStressTest(input, 'p', ['license']);
  expect(single.choices.map((c) => c.count)).toEqual([2, 1]);
  expect(single.affected.map((r) => [r.requirement.id, r.remaining])).toEqual([
    ['two', 0],
    ['one', 1],
  ]);
  expect(single.withoutAlternative).toBe(1);
  expect(evidenceStressTest(input, 'p', ['license', 'reference']).withoutAlternative).toBe(2);
  expect(JSON.stringify(input)).toBe(original);
});

test('stale, inaccessible, disabled and out-of-pursuit evidence never enters the scenario', () => {
  const input = data();
  input.evidenceReviews[0].approval_current = null;
  input.evidenceReviews.push(review('two', 'not-loaded'));
  const result = evidenceStressTest(input, 'p', ['not-loaded', 'foreign']);
  expect(result.selectedCount).toBe(0);
  expect(result.omitted).toBe(true);
  expect(result.choices.find((c) => c.id === 'license')?.count).toBe(1);
  input.evidenceReviewsEnabled = false;
  expect(evidenceStressTest(input, 'p', ['license']).choices).toEqual([]);
});

test('duplicate approvals are one evidence record, and stale selections cannot survive lost visibility', () => {
  const input = data();
  input.evidenceReviews.push(review('one', 'reference'));
  expect(evidenceStressTest(input, 'p', ['license']).affected[1].remaining).toBe(1);
  input.facts = [];
  const result = evidenceStressTest(input, 'p', ['license']);
  expect(result.selectedCount).toBe(0);
  expect(result.affected).toEqual([]);
});

test('empty and limited views never yield a complete-readiness claim', () => {
  expect(evidenceStressTest({ facts: [] }, 'p').choices).toEqual([]);
  const input = data();
  input.facts = Array.from({ length: 500 }, (_, i) => fact(String(i)));
  expect(evidenceStressTest(input, 'p').partial).toBe(true);
  input.facts = [];
  input.evidenceReviews = Array.from({ length: 500 }, () => review('one', 'a'));
  expect(evidenceStressTest(input, 'p').partial).toBe(true);
});
