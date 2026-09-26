import { test, expect } from '@playwright/test';
import {
  sealSavedConversation,
  readSavedConversation,
} from '../apps/web/lib/ai/saved-conversation';
import { readConversation, renewConversation } from '../apps/web/lib/ai/conversation';
import type { Answer } from '../apps/web/lib/ai/contracts';
const scope = {
  user: 'user',
  organization: 'org',
  role: 'viewer',
  mode: 'workspace',
  context: 'bid',
};
const expected = { ...scope, pursuit: 'bid' };
const answer: Answer = {
  answer: [{ text: 'Private response', sources: [] }],
  risks: [],
  nextAction: 'Review',
  notice: 'AI',
  citations: [],
  evidence: [],
  continuation: 'NEVER_SAVE',
  actionToken: 'NEVER_RESTORE',
  saveCheckpoint: 'NEVER_NEST',
};
test('saved bid checkpoint encrypts text, expires and binds user, company, role and bid', () => {
  const memory = readConversation(undefined, 'secret', scope);
  memory.turns = [{ question: 'Private question', answer: 'Private response' }];
  const token = sealSavedConversation(memory, answer, 'bid', 'request', 'secret')!;
  expect(token).not.toContain('Private');
  const saved = readSavedConversation(token, 'secret', expected);
  expect(saved.answer.actionToken).toBeUndefined();
  expect(saved.answer.continuation).toBeUndefined();
  expect(saved.answer.saveCheckpoint).toBeUndefined();
  expect(saved.memory.turns[0].question).toBe('Private question');
  for (const field of ['user', 'organization', 'role', 'pursuit'] as const)
    expect(() =>
      readSavedConversation(token, 'secret', { ...expected, [field]: 'other' }),
    ).toThrow();
  expect(() => readSavedConversation(token, 'other', expected)).toThrow();
  expect(() =>
    readSavedConversation(token, 'secret', expected, Date.now() + 31 * 86400000),
  ).toThrow();
  expect(() => readSavedConversation('A' + token.slice(1), 'secret', expected)).toThrow();
  const resumed = renewConversation({ ...saved.memory, expires: 0 }, 'secret')!;
  expect(readConversation(resumed, 'secret', scope).turns).toEqual(memory.turns);
});
