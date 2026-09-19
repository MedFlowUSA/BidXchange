import { AiError } from './contracts';
export async function readJsonBody(request: Request, limit: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new AiError('invalid_request');
  const reader = request.body?.getReader();
  if (!reader) throw new AiError('invalid_request');
  const decoder = new TextDecoder();
  let raw = '',
    size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new AiError('invalid_request', 413);
    }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  try {
    return JSON.parse(raw);
  } catch {
    throw new AiError('invalid_request');
  }
}
