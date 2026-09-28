import { test, expect } from '@playwright/test';
import { companyLogo } from '../apps/web/lib/company-logo';
import type { Fact } from '../apps/web/lib/tenant-types';

test('company logo renders only an unambiguous authorized local branding record', () => {
  const logo = {
    fact_type: 'identity',
    label: 'Company logo',
    value: '/company-brand/example.png',
  } as Fact;
  expect(companyLogo([logo])).toBe('/company-brand/example.png');
  expect(companyLogo([])).toBeNull();
  expect(companyLogo([logo, logo])).toBeNull();
  for (const value of [
    'https://example.com/tracker.png',
    '//example.com/a.png',
    '/company-brand/../a.png',
    '/company-brand/a.svg',
    '/company-brand/a.png?secret=value',
    'data:image/png;base64,abc',
  ])
    expect(companyLogo([{ ...logo, value }])).toBeNull();
  expect(companyLogo([{ ...logo, fact_type: 'personnel' }])).toBeNull();
});
