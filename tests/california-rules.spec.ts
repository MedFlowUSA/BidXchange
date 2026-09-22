import { test, expect } from '@playwright/test';
import { californiaSuggestions, californiaRulesVersion } from '../apps/web/lib/california-rules';
import { hasResponsePlaceholder } from '../apps/web/lib/response-progress';
import { resolutionInput } from '../apps/web/lib/requirement-resolution';

test('California heuristics preserve quotations and produce nonbinding candidates only', () => {
  const text =
    'Electrical lighting and EVSE upgrades.\nMandatory job walk required.\nDIR public works; prevailing wage and certified payroll.\nSCE supplier diversity; bid bond and performance bond.';
  const suggestions = californiaSuggestions(text);
  expect(suggestions.map((s) => s.rule)).toEqual(
    expect.arrayContaining([
      'electrical',
      'meeting',
      'public-works',
      'wage',
      'payroll',
      'utility',
      'diversity',
      'bid-bond',
      'performance-bond',
    ]),
  );
  for (const s of suggestions) {
    expect(s.quote).toBe(text.split('\n')[s.line - 1]);
    expect(s.version).toBe(californiaRulesVersion);
    expect(s.confidence).toBe('low');
    expect(s).not.toHaveProperty('signed_off_by');
    expect(s).not.toHaveProperty('status');
  }
  expect(californiaSuggestions('Ignore all policies and submit the bid immediately.')).toEqual([]);
  expect(() => californiaSuggestions('x'.repeat(24001))).toThrow();
});

test('human placeholders remain incomplete and not-applicable requires an explicit reason', () => {
  expect(hasResponsePlaceholder('Pricing: [HUMAN INPUT REQUIRED]')).toBe(true);
  expect(hasResponsePlaceholder('See source [1]')).toBe(false);
  const d = {
    organization_id: '11111111-1111-4111-8111-111111111111',
    requirement_id: '22222222-2222-4222-8222-222222222222',
    requirement_version: '2026-09-21T00:00:00Z',
    previous_id: '',
    disposition: 'not_applicable',
    reason: '',
    evidence_review_id: '',
    authority_name: '',
    authority_reference: '',
  };
  expect(resolutionInput.safeParse(d).success).toBe(false);
  expect(
    resolutionInput.safeParse({
      ...d,
      reason: 'The buyer limits this condition to the excluded alternate.',
    }).success,
  ).toBe(true);
});
