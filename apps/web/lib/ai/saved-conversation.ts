import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { AiError, type Answer } from './contracts';
import type { ChatMemory } from './conversation';

export type SavedConversation = {
  version: 1;
  id: string;
  pursuit: string;
  expires: number;
  memory: ChatMemory;
  answer: Answer;
};
const key = (secret: string) =>
  createHash('sha256')
    .update('bidbuddy-saved-v1\0' + secret)
    .digest();
export function sealSavedConversation(
  memory: ChatMemory,
  answer: Answer,
  pursuit: string,
  id: string,
  secret: string,
): string | undefined {
  // Never persist bearer capabilities or recursively nested checkpoints.
  const display = { ...answer };
  delete display.continuation;
  delete display.actionToken;
  delete display.saveCheckpoint;
  const value: SavedConversation = {
    version: 1,
    id,
    pursuit,
    expires: Date.now() + 30 * 86400000,
    memory,
    answer: display,
  };
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) > 110000) return undefined;
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function readSavedConversation(
  token: string,
  secret: string,
  expected: { user: string; organization: string; role: string; pursuit: string },
  now = Date.now(),
): SavedConversation {
  try {
    const bytes = Buffer.from(token, 'base64url');
    if (bytes.length < 29 || bytes.length > 110028) throw Error();
    const cipher = createDecipheriv('aes-256-gcm', key(secret), bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    const value: SavedConversation = JSON.parse(
      Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'),
    );
    if (
      value.version !== 1 ||
      value.expires <= now ||
      value.pursuit !== expected.pursuit ||
      value.memory.scope.mode !== 'workspace' ||
      value.memory.scope.user !== expected.user ||
      value.memory.scope.organization !== expected.organization ||
      value.memory.scope.role !== expected.role ||
      value.memory.turns.length > 8 ||
      value.memory.refs.length > 32
    )
      throw Error();
    return value;
  } catch {
    throw new AiError('conversation_changed', 409);
  }
}
