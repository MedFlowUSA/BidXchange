import { test, expect } from '@playwright/test';
import { demoCookie, verifyDemoCookie, demoRequest } from '../apps/web/lib/ai/public-demo';
test('demo cookie authentication and request schema exclude organization access', () => {
  const id = '11111111-1111-4111-8111-111111111111',
    key = 'synthetic-demo-key';
  expect(verifyDemoCookie(key, demoCookie(key, id))).toBe(id);
  expect(verifyDemoCookie('other', demoCookie(key, id))).toBeNull();
  expect(verifyDemoCookie(key, 'forged')).toBeNull();
  expect(
    demoRequest.safeParse({ requestId: id, prompt: 'Hello', organizationId: id }).success,
  ).toBe(false);
  expect(demoRequest.safeParse({ requestId: id, prompt: 'x'.repeat(1501) }).success).toBe(false);
});
test('disabled public API rejects generation without a paid request', async ({ request }) => {
  const status = await request.get('/api/demo-assistant');
  expect((await status.json()).available).toBe(false);
  const result = await request.post('/api/demo-assistant', {
    headers: { origin: 'http://127.0.0.1:3000' },
    data: { requestId: '11111111-1111-4111-8111-111111111111', prompt: 'Hello' },
  });
  expect(result.status()).toBe(503);
  const cross = await request.post('/api/demo-assistant', {
    headers: { origin: 'https://other.invalid' },
    data: { prompt: 'Hello' },
  });
  expect(cross.status()).toBe(403);
});
