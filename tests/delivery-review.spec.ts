import { test, expect } from '@playwright/test';
import { deliveryReview } from '../apps/web/lib/delivery-review';
import { qualificationData } from './fixtures/qualification-data';
import { pursuit } from './fixtures/workflow-data';

test('delivery review uses only explicit structured records and preserves stale evidence status', () => {
  const data = qualificationData();
  data.facts[0].structured_kind = 'equipment';
  data.facts[0].expiration_date = '2020-01-01';
  const before = JSON.stringify(data);
  const rows = deliveryReview(data, pursuit);
  expect(rows.find((r) => r.id === 'equipment')!.records[0].status).toBe('expired');
  expect(rows.find((r) => r.id === 'staffing')!.records).toEqual([]);
  expect(rows.find((r) => r.id === 'suppliers')!.records).toEqual([]);
  expect(deliveryReview(data, 'inaccessible')).toEqual([]);
  expect(JSON.stringify(data)).toBe(before);
  data.facts[0].structured_kind = null;
  data.facts[0].label = 'Equipment availability';
  expect(deliveryReview(data, pursuit).every((r) => !r.records.length)).toBe(true);
});
