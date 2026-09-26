import type { Answer } from './contracts';

export class AssistantResponseError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const assistantResponseByteLimit = 2_000_000;
const incomplete = () =>
  new AssistantResponseError(
    'incomplete_response',
    'The response ended before a complete answer arrived. Your question has been kept; please retry.',
  );
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Transport validation only. Evidence authorization and answer validation stay on the server.
function isAnswer(value: unknown): value is Answer {
  return (
    object(value) &&
    Array.isArray(value.answer) &&
    value.answer.every(
      (row: unknown) => object(row) && typeof row.text === 'string' && Array.isArray(row.sources),
    ) &&
    Array.isArray(value.risks) &&
    typeof value.nextAction === 'string' &&
    Array.isArray(value.citations) &&
    Array.isArray(value.evidence)
  );
}

export async function requestAssistantAnswer(
  body: Record<string, unknown>,
  options: { signal: AbortSignal; onStatus?: (text: string) => void; timeoutMs?: number },
  fetcher: typeof fetch = fetch,
): Promise<Answer> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  options.signal.addEventListener('abort', cancel, { once: true });
  if (options.signal.aborted) cancel();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 90_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    controller.signal.throwIfAborted();
    const response = await fetcher('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const failure: unknown = await response.json().catch(() => null);
      throw new AssistantResponseError(
        object(failure) && typeof failure.code === 'string' ? failure.code : 'service_unavailable',
        object(failure) && typeof failure.message === 'string' && failure.message.length <= 2000
          ? failure.message
          : 'BidBuddy could not connect. Your question has been kept; please try again.',
      );
    }
    reader = response.body?.getReader();
    if (!reader) throw incomplete();
    const stopReading = () => {
      void reader?.cancel().catch(() => {});
    };
    controller.signal.addEventListener('abort', stopReading, { once: true });
    const decoder = new TextDecoder();
    let buffer = '',
      bytes = 0,
      events = 0;
    let answer: Answer | undefined;
    const consume = (line: string) => {
      if (!line.trim()) return;
      if (++events > 128) throw incomplete();
      const event: unknown = JSON.parse(line);
      if (!object(event)) throw incomplete();
      if (event.type === 'error') {
        throw new AssistantResponseError(
          typeof event.code === 'string' ? event.code : 'service_unavailable',
          typeof event.message === 'string' && event.message.length <= 2000
            ? event.message
            : 'BidBuddy could not finish the answer. Please retry.',
        );
      }
      if (event.type === 'status' && typeof event.text === 'string' && event.text.length <= 1000) {
        options.onStatus?.(event.text);
      } else if (event.type === 'answer' && isAnswer(event.answer) && !answer) {
        answer = event.answer;
      } else {
        throw incomplete();
      }
    };
    try {
      while (true) {
        controller.signal.throwIfAborted();
        const { done, value } = await reader.read();
        controller.signal.throwIfAborted();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > assistantResponseByteLimit) throw incomplete();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) consume(line);
      }
      consume(buffer + decoder.decode());
      if (!answer) throw incomplete();
      return answer;
    } finally {
      controller.signal.removeEventListener('abort', stopReading);
    }
  } catch (error) {
    if (controller.signal.aborted)
      throw new AssistantResponseError(
        timedOut ? 'timeout' : 'cancelled',
        timedOut
          ? 'BidBuddy took too long to respond. Your input has been kept; please retry.'
          : 'Generation cancelled.',
      );
    if (error instanceof AssistantResponseError) throw error;
    throw incomplete();
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener('abort', cancel);
    if (reader) {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}
