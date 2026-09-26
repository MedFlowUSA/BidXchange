import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { AiError, type Evidence, type Answer } from './contracts';
export type ChatTurn = { question: string; answer: string };
export type ChatScope = {
  user: string;
  organization: string;
  role: string;
  mode: string;
  context: string;
};
type Ref = { type: string; id: string; hash: string };
export type ChatMemory = { scope: ChatScope; expires: number; turns: ChatTurn[]; refs: Ref[] };
const key = (secret: string) =>
  createHash('sha256')
    .update('bidxchange-conversation-v1\0' + secret)
    .digest();
export const evidenceHash = (e: Evidence) =>
  createHash('sha256').update(JSON.stringify(e)).digest('hex');
export function readConversation(
  token: string | undefined,
  secret: string,
  scope: ChatScope,
  now = Date.now(),
): ChatMemory {
  if (!token) return { scope, expires: Date.now() + 30 * 60_000, turns: [], refs: [] };
  try {
    const bytes = Buffer.from(token, 'base64url');
    if (bytes.length < 29 || bytes.length > 52000) throw Error();
    const decipher = createDecipheriv('aes-256-gcm', key(secret), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(
      Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'),
    ) as ChatMemory;
    if (
      JSON.stringify(data.scope) !== JSON.stringify(scope) ||
      data.expires < now ||
      data.turns.length > 4 ||
      data.refs.length > 32
    )
      throw Error();
    return data;
  } catch {
    throw new AiError('conversation_changed', 409);
  }
}
export async function checkConversation(
  memory: ChatMemory,
  source: (type: string, id: string) => Promise<Evidence>,
) {
  try {
    for (const ref of memory.refs) {
      const fresh = await source(ref.type, ref.id);
      if (evidenceHash(fresh) !== ref.hash) throw Error();
    }
  } catch {
    throw new AiError('conversation_changed', 409);
  }
}
export function sealConversation(
  memory: ChatMemory,
  secret: string,
  question: string,
  answer: Answer,
  records: Evidence[],
): string | undefined {
  const refs = new Map(memory.refs.map((r) => [r.type + ':' + r.id, r]));
  for (const e of records)
    refs.set(e.citation.key, { type: e.citation.type, id: e.citation.id, hash: evidenceHash(e) });
  // Selected reviews need room for eight clauses plus their company evidence.
  if (refs.size > (answer.requirementReview ? 32 : 16)) return undefined;
  const prose = [
    ...answer.answer.map((a) => a.text),
    ...answer.risks,
    answer.nextAction,
    ...(answer.proposedTasks ?? []).map(
      (task) => `Unsaved task suggestion: ${task.title}. ${task.explanation}`,
    ),
    ...(answer.requirementReview ?? []).map(
      (row) =>
        `AI review suggestion: ${row.meaning}\n${row.comparison}\nSuggested next step: ${row.nextStep}`,
    ),
  ]
    .filter(Boolean)
    .join('\n\n');
  const turns = [...memory.turns, { question, answer: prose }].slice(-4);
  while (JSON.stringify(turns).length > 24000 && turns.length > 1) turns.shift();
  const value = JSON.stringify({
    scope: memory.scope,
    expires: Date.now() + 30 * 60_000,
    turns,
    refs: [...refs.values()],
  });
  if (Buffer.byteLength(value, 'utf8') > 51000) return undefined;
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
