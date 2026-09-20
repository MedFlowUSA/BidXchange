import { test, expect } from '@playwright/test';
import { resolutionInput } from '../apps/web/lib/requirement-resolution';
import { pursuitBrief } from '../apps/web/lib/pursuit-brief';
import type { RequirementResolution } from '../apps/web/lib/requirement-resolution';
const id = '11111111-1111-4111-8111-111111111111';
const input = {
  organization_id: id,
  requirement_id: id,
  requirement_version: '2026-09-20T00:00:00Z',
  previous_id: '',
  disposition: 'blocked',
  reason: 'Review needed',
  evidence_review_id: '',
  authority_name: '',
  authority_reference: '',
};
test('resolution inputs require version, supporting approval or documented waiver and discard browser authority', () => {
  expect(resolutionInput.safeParse({ ...input, disposition: 'supported' }).success).toBe(false);
  expect(resolutionInput.safeParse({ ...input, disposition: 'waived' }).success).toBe(false);
  expect(
    resolutionInput.safeParse({
      ...input,
      disposition: 'waived',
      authority_name: 'Buyer',
      authority_reference: 'Amendment 2',
    }).success,
  ).toBe(true);
  expect(resolutionInput.safeParse({ ...input, requirement_version: '' }).success).toBe(false);
  expect(
    resolutionInput.parse({ ...input, reviewed_by: id, review_current: true }),
  ).not.toHaveProperty('review_current');
});
test('current human resolution supersedes intake blockers without inferring inaccessible evidence', () => {
  const requirement = {
    id,
    pursuit_id: 'p',
    requirement: 'License',
    citation: 'Section 2',
    status: 'blocked',
    owner_user_id: id,
    updated_at: '2026-09-20T00:00:00Z',
  };
  const resolution: RequirementResolution = {
    id: 'review',
    requirement_id: id,
    disposition: 'waived',
    reason: 'Documented buyer waiver',
    authority_name: 'Buyer',
    authority_reference: 'Amendment 2',
    reviewed_by: id,
    reviewed_at: requirement.updated_at,
    review_current: true,
  };
  const data = {
    requirements: [requirement],
    resolutionsEnabled: true,
    resolutions: [resolution],
    evidenceReviewsEnabled: true,
    evidenceReviews: [],
  };
  let result = pursuitBrief(data, 'p').rows[0];
  expect(result.resolved).toBe(true);
  expect(result.blocked).toBe(false);
  expect(result.issues).toEqual([]);
  expect(result.approved).toBe(0);
  resolution.review_current = false;
  result = pursuitBrief(data, 'p').rows[0];
  expect(result.resolved).toBe(false);
  expect(result.blocked).toBe(true);
  expect(result.issues).toContain('Requirement review is no longer current');
  data.resolutionsEnabled = false;
  result = pursuitBrief(data, 'p').rows[0];
  expect(result.resolution).toBeUndefined();
  expect(result.blocked).toBe(true);
});
