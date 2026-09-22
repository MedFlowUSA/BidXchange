import { test, expect } from '@playwright/test';
import { freshnessRadar, californiaPassportSteps } from '../apps/web/lib/california-passport';
import { qualificationData } from './fixtures/qualification-data';
import { passportRecords } from '../apps/web/lib/passport-records';
import { structuredErrors } from '../apps/web/lib/company-fields';

test('California Level 1 covers contractor core fields without numeric readiness', () => {
  const labels = californiaPassportSteps.flatMap((s) => s.items.map((i) => i.label));
  expect(labels).toContain('DIR public-works registration');
  expect(labels).toContain('CSLB license and classifications');
  expect(labels.filter((l) => l.startsWith('Past project'))).toHaveLength(3);
  expect(
    structuredErrors('bonding', {
      single_band: '$250k–$1m',
      aggregate_band: 'Unknown',
      bid_bond: 'Needs confirmation',
    }),
  ).toEqual([]);
  expect(structuredErrors('uei_cage', { last_checked: '2026-02-30' })).not.toEqual([]);
});
test('Radar distinguishes stale, expired, missing and 30/60/90 day windows', () => {
  const base = qualificationData().facts[0];
  const records = ['2026-09-20', '2026-10-01', '2026-11-01', '2026-12-01', null].map(
    (expiration_date, i) => ({
      ...base,
      id: String(i),
      expiration_date,
      verified_at: '2026-01-01T00:00:00Z',
    }),
  );
  const radar = freshnessRadar(records, '2026-09-21T00:00:00Z');
  expect(radar.map((r) => r.window)).toEqual(['expired', '30', '60', '90', null]);
  expect(radar.every((r) => r.stale)).toBe(true);
  expect(radar[4].missingExpiration).toBe(true);
  expect(freshnessRadar([{ ...base, verified_at: null }], '2026-09-21')[0].missingChecked).toBe(
    true,
  );
});
test('one insurance record or past project cannot silently fulfill every requested item', () => {
  const fact = {
    ...qualificationData().facts[0],
    fact_type: 'insurance',
    structured_kind: 'insurance',
    label: 'GL policy',
    structured_fields: { type: 'General liability' },
  };
  expect(
    passportRecords([fact], { type: 'insurance', label: 'Commercial auto insurance' }),
  ).toEqual([]);
  expect(
    passportRecords([fact], { type: 'insurance', label: 'General liability insurance' }),
  ).toHaveLength(1);
});
