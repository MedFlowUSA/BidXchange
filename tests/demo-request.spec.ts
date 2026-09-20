import { test, expect } from '@playwright/test';
import { demoRequestSchema } from '../apps/web/lib/demo-request';

test('public intake rejects missing consent, honeypot content, oversized and invalid fields', () => {
  const input = {
    name: 'Prospect',
    email: 'PERSON@example.invalid',
    company: 'Company',
    message: '',
    consent: 'yes',
    website_confirm: '',
  };
  expect(demoRequestSchema.parse(input).email).toBe('person@example.invalid');
  for (const change of [
    { consent: '' },
    { website_confirm: 'bot' },
    { email: 'not-email' },
    { message: 'x'.repeat(1501) },
    { name: ' ' },
    { company: 'x'.repeat(201) },
  ]) {
    expect(demoRequestSchema.safeParse({ ...input, ...change }).success).toBe(false);
  }
});
