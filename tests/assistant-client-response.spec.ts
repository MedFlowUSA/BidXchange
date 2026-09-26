import { test, expect } from '@playwright/test';
import {
  requestAssistantAnswer,
  assistantResponseByteLimit,
} from '../apps/web/lib/ai/client-response';

const answer = {
  answer: [{ text: 'Café — review the source.', sources: [] }],
  risks: [],
  nextAction: 'Review',
  citations: [],
  evidence: [],
  notice: 'AI suggestion',
};
const event = JSON.stringify({ type: 'answer', answer });
const options = () => ({ signal: new AbortController().signal });
const response = (body: string) => (async () => new Response(body)) as typeof fetch;

test('client decodes split UTF-8, status and final answer without a trailing newline', async () => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ type: 'status', text: 'Reading records' }) + '\n' + event,
  );
  let offset = 0;
  const statuses: string[] = [];
  const fetcher = (async () =>
    new Response(
      new ReadableStream({
        pull(c) {
          if (offset < bytes.length) c.enqueue(bytes.slice(offset, ++offset));
          else c.close();
        },
      }),
    )) as typeof fetch;
  expect(
    await requestAssistantAnswer(
      {},
      { ...options(), onStatus: (text) => statuses.push(text) },
      fetcher,
    ),
  ).toEqual(answer);
  expect(statuses).toEqual(['Reading records']);
});

test('client rejects partial, malformed, duplicate, oversized and failed streams before returning an answer', async () => {
  for (const body of [
    '',
    '{"type":"answer"',
    '{"type":"answer","answer":{}}',
    event + '\n' + event,
    'x'.repeat(assistantResponseByteLimit + 1),
    event + '\n' + JSON.stringify({ type: 'error', code: 'forbidden', message: 'Access changed.' }),
  ]) {
    await expect(requestAssistantAnswer({}, options(), response(body))).rejects.toThrow();
  }
  await expect(
    requestAssistantAnswer(
      {},
      options(),
      response('{"type":"error","code":"conversation_changed","message":"Refresh records."}'),
    ),
  ).rejects.toMatchObject({ code: 'conversation_changed', message: 'Refresh records.' });
  const html = (async () =>
    new Response('<html>Gateway internals</html>', { status: 502 })) as typeof fetch;
  await expect(requestAssistantAnswer({}, options(), html)).rejects.toThrow(
    'BidBuddy could not connect',
  );
});

test('client cancellation and timeout release a stalled reader without releasing a buffered answer', async () => {
  for (const timeout of [false, true]) {
    const abort = new AbortController();
    let cancelled = false;
    const fetcher = (async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode(event + '\n'));
          },
          cancel() {
            cancelled = true;
          },
        }),
      )) as typeof fetch;
    const pending = requestAssistantAnswer(
      {},
      { signal: abort.signal, timeoutMs: timeout ? 20 : 1000 },
      fetcher,
    );
    if (!timeout) setTimeout(() => abort.abort(), 10);
    await expect(pending).rejects.toMatchObject({ code: timeout ? 'timeout' : 'cancelled' });
    expect(cancelled).toBe(true);
  }
  const abort = new AbortController();
  abort.abort();
  let called = false;
  await expect(
    requestAssistantAnswer({}, { signal: abort.signal }, (async () => {
      called = true;
      return new Response(event);
    }) as typeof fetch),
  ).rejects.toMatchObject({ code: 'cancelled' });
  expect(called).toBe(false);
});
