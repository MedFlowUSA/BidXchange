import { test, expect } from '@playwright/test';
import { bidAlignment } from '../apps/web/lib/bid-alignment';
import { bidReport } from '../apps/web/lib/bid-report';
import { qualificationData } from './fixtures/qualification-data';
import { pursuit } from './fixtures/workflow-data';
const now = new Date('2026-09-28T12:00:00Z');
function current() {
  const d = qualificationData();
  d.opportunities[0].official_deadline = '2026-10-06T23:00:00Z';
  d.facts[0].expiration_date = '2026-11-01';
  return d;
}
test('resource alignment counts requirements once and never offsets a blocker', () => {
  const d = current();
  d.evidenceReviews!.push({ ...d.evidenceReviews![0], id: 'duplicate' });
  const a = bidAlignment(d, pursuit, false, now);
  expect(a.percent).toBe(50);
  expect(a.supported).toBe(1);
  expect(a.applicable).toBe(2);
  expect(a.blocked).toBe(1);
  d.requirements!.push({ ...d.requirements![0], id: 'foreign', pursuit_id: 'foreign' });
  expect(bidAlignment(d, pursuit, false, now).applicable).toBe(2);
  d.resolutions![0].disposition = 'blocked';
  expect(bidAlignment(d, pursuit, false, now).percent).toBe(0);
});
test('only current documented exclusions change the denominator; empty register is not 100 percent', () => {
  const d = current();
  d.resolutions!.push({
    ...d.resolutions![0],
    id: 'na',
    requirement_id: d.requirements![1].id,
    disposition: 'not_applicable',
  });
  expect(bidAlignment(d, pursuit, false, now).percent).toBe(100);
  d.resolutions![1].review_current = false;
  expect(bidAlignment(d, pursuit, false, now).percent).toBe(50);
  d.resolutions![1].review_current = true;
  d.resolutions![1].disposition = 'waived';
  expect(bidAlignment(d, pursuit, false, now).percent).toBe(50);
  d.resolutions![1].authority_name = 'Buyer';
  d.resolutions![1].authority_reference = 'Letter';
  expect(bidAlignment(d, pursuit, false, now).percent).toBe(100);
  d.resolutions![0].disposition = 'not_applicable';
  expect(bidAlignment(d, pursuit, false, now).percent).toBeNull();
  d.requirements = [];
  expect(bidAlignment(d, pursuit, false, now).percent).toBeNull();
});
test('stale, unreviewed, future, missing-date and deadline-expiring evidence cannot raise coverage', () => {
  for (const change of [
    'expired',
    'stale',
    'future',
    'pending',
    'no-expiry',
    'deadline',
    'unapproved',
    'unattested',
    'review-stale',
  ]) {
    const d = current();
    if (change === 'expired') d.facts[0].expiration_date = '2026-09-01';
    if (change === 'stale') d.facts[0].verified_at = '2026-01-01T00:00:00Z';
    if (change === 'future') d.facts[0].effective_date = '2026-10-01';
    if (change === 'pending') d.facts[0].verification_status = 'pending_verification';
    if (change === 'no-expiry') d.facts[0].expiration_date = null;
    if (change === 'deadline') d.facts[0].expiration_date = '2026-10-06';
    if (change === 'unapproved') d.evidenceReviews![0].approval_current = false;
    if (change === 'unattested') d.facts[0].verified_by = null;
    if (change === 'review-stale') d.resolutions![0].review_current = false;
    expect(bidAlignment(d, pursuit, false, now).percent, change).toBe(0);
  }
});
test('missing or inaccessible data suppresses the percentage without leaking restricted values', () => {
  const d = current();
  d.facts[0].sensitivity = 'restricted';
  d.facts[0].value = 'PRIVATE RESOURCE';
  const a = bidAlignment(d, pursuit, false, now);
  expect(a.percent).toBeNull();
  expect(JSON.stringify(a)).not.toContain('PRIVATE RESOURCE');
  expect(bidAlignment(d, pursuit, true, now).percent).toBe(50);
  d.organization.role = 'viewer';
  expect(JSON.stringify(bidAlignment(d, pursuit, true, now))).not.toContain('PRIVATE RESOURCE');
  for (const change of [
    'no-deadline',
    'past',
    'zone',
    'missing-reviews',
    'partial',
    'not-loaded',
  ]) {
    const x = current();
    if (change === 'no-deadline') x.opportunities[0].official_deadline = null;
    if (change === 'past') x.opportunities[0].official_deadline = '2026-01-01T00:00:00Z';
    if (change === 'zone') x.opportunities[0].deadline_timezone = 'invalid';
    if (change === 'missing-reviews') x.resolutionsEnabled = false;
    if (change === 'partial') x.facts = Array(500).fill(x.facts[0]);
    if (change === 'not-loaded') x.requirements = undefined;
    expect(bidAlignment(x, pursuit, false, now).percent, change).toBeNull();
  }
});
test('topic leads stay suggestions, including mismatched jurisdictions and license-bond limits', () => {
  const d = current();
  d.evidenceReviews = [];
  d.resolutions = [];
  d.facts[0].value = 'California CSLB B only';
  d.requirements![0].requirement = 'Pennsylvania trade license coverage';
  d.facts.push({ ...d.facts[0], id: 'unknown', sensitivity: 'unknown', value: 'HIDDEN LICENSE' });
  const a = bidAlignment(d, pursuit, false, now);
  expect(a.percent).toBe(0);
  expect(
    a.rows.find((r) => r.requirement.id === d.requirements![0].id)!.suggested[0].reason,
  ).toContain('jurisdiction');
  expect(JSON.stringify(a)).not.toContain('HIDDEN LICENSE');
  d.requirements![0].requirement = 'SAM registration';
  d.facts = [
    {
      ...d.facts[0],
      fact_type: 'registration',
      label: 'USDOT registration',
      value: 'USDOT 2687525',
    },
  ];
  expect(bidAlignment(d, pursuit, false, now).rows.every((r) => r.suggested.length === 0)).toBe(
    true,
  );
});
test('report leads with job analysis and preserves draft answers and evidence gaps before the company appendix', () => {
  const d = current(),
    doc = bidReport(d, pursuit, { latestDraft: true }, now),
    text = doc.blocks.map((b) => b.text).join('\n');
  expect(text).toContain('Reviewed resource alignment: 50%');
  expect(text).toContain('Synthetic answer');
  expect(text).toContain('Suggested response-planning step');
  expect(text.indexOf('The job:')).toBeLessThan(text.indexOf('Appendix: company'));
  expect(text.indexOf('Job requirement')).toBeLessThan(text.indexOf('Appendix: company'));
  expect(text).toContain('not legal eligibility');
});

test('payment bonds and technical demonstrations retain their specific planning guidance', () => {
  for (const [requirement, expected] of [
    ['Provide payment and performance bonds', 'Ask the surety'],
    ['Demonstrates weatherization installation experience', 'Select comparable completed projects'],
    ['Provide human-approved pricing and payment terms', 'estimator and finance lead'],
  ]) {
    const d = current();
    d.requirements![0].requirement = requirement;
    expect(
      bidAlignment(d, pursuit, false, now).rows.find(
        (r) => r.requirement.id === d.requirements![0].id,
      )!.approach,
    ).toContain(expected);
  }
});
