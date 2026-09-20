import { test, expect } from '@playwright/test';
import { pursuitBrief } from '../apps/web/lib/pursuit-brief';
import type { TenantData } from '../apps/web/lib/tenant-types';

const requirement = (id: string, status = 'needs_review') => ({
  id,
  pursuit_id: 'pursuit',
  requirement: id,
  citation: 'Section 2',
  status,
  owner_user_id: null,
  updated_at: '2026-09-20T00:00:00Z',
});
const review = (
  requirement_id: string,
  approval_current: boolean | null,
  proposal_use = 'approved',
) => ({
  id: requirement_id,
  requirement_id,
  fact_id: 'fact',
  applicability: 'applicable',
  proposal_use,
  approval_current,
  reason: 'Reason',
  reviewed_by: 'reviewer',
  reviewed_at: '2026-09-20T00:00:00Z',
});

test('brief prioritizes blockers and stale evidence while keeping approval distinct from compliance', () => {
  const data = {
    evidenceReviewsEnabled: true,
    requirements: [
      requirement('current'),
      requirement('stale'),
      requirement('blocked', 'blocked'),
      { ...requirement('foreign'), pursuit_id: 'other' },
    ],
    evidenceReviews: [review('current', true), review('stale', null)],
  };
  const brief = pursuitBrief(data, 'pursuit');
  expect(brief.rows.map((r) => r.requirement.id)).toEqual(['blocked', 'stale', 'current']);
  expect(brief.rows[1].issues).toContain('Previous evidence approval needs review');
  expect(brief.rows[2].approved).toBe(1);
  expect(brief.rows[2].issues).toContain('Review owner missing');
  expect(data.requirements[0].id).toBe('current');
});

test('non-applicability never waives a requirement and disabled reviews do not imply absent approvals', () => {
  const data = {
    evidenceReviewsEnabled: true,
    requirements: [requirement('r')],
    evidenceReviews: [{ ...review('r', false, 'not_approved'), applicability: 'not_applicable' }],
  };
  expect(pursuitBrief(data, 'pursuit').rows[0].issues).toContain(
    'No current evidence approval visible',
  );
  data.evidenceReviewsEnabled = false;
  expect(pursuitBrief(data, 'pursuit').rows[0].issues).not.toContain(
    'No current evidence approval visible',
  );
});

test('empty and truncated authorized views never imply complete qualification', () => {
  expect(pursuitBrief({}, 'pursuit').rows).toEqual([]);
  const requirements = Array.from({ length: 501 }, (_, i) => requirement(String(i)));
  const result = pursuitBrief({ requirements }, 'pursuit');
  expect(result.partial).toBe(true);
  expect(result.rows).toHaveLength(500);
  const evidenceReviews = Array.from({ length: 500 }, () =>
    review('r', true),
  ) as TenantData['evidenceReviews'];
  expect(
    pursuitBrief({ requirements: [requirement('r')], evidenceReviews }, 'pursuit').partial,
  ).toBe(true);
});
