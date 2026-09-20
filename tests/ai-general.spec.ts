import { test, expect } from '@playwright/test';
import { generalAnswer } from '../apps/web/lib/ai/general';
import { runAssistant, type ModelClient } from '../apps/web/lib/ai/engine';
import { AiError } from '../apps/web/lib/ai/contracts';
import type { EvidenceTools } from '../apps/web/lib/ai/tools';
function client(text: string, inspect: (args: Record<string, unknown>) => void = () => {}) {
  return {
    responses: {
      async create(args: Record<string, unknown>) {
        inspect(args);
        return (async function* () {
          yield {
            type: 'response.completed',
            response: {
              output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
              usage: { input_tokens: 12, output_tokens: 20 },
            },
          };
        })();
      },
    },
  } as unknown as ModelClient;
}
test('general answers retain useful prose without querying or transmitting workspace evidence', async () => {
  const result = await runAssistant(
    client('A bid bond provides assurance to the buyer.', (args) => {
      expect(args.tools).toBeUndefined();
      expect(args.store).toBe(false);
      expect(args.input).toEqual([{ role: 'user', content: 'Explain a bid bond' }]);
    }),
    'test-model',
    'Explain a bid bond',
    null,
    {
      run: () => {
        throw new Error('must not query records');
      },
    } as unknown as EvidenceTools,
    new AbortController().signal,
    () => {},
    async () => {},
    'general',
  );
  expect(result.answer.answer[0].text).toContain('assurance');
  expect(result.answer.evidence).toEqual([]);
  expect(result.answer.citations).toEqual([]);
});
test('general responses stop after role revocation or cancellation and reject empty output', async () => {
  let checks = 0;
  await expect(
    generalAnswer(client('Answer'), 'test', 'Question', new AbortController().signal, async () => {
      if (++checks === 2) throw new AiError('forbidden');
    }),
  ).rejects.toMatchObject({ code: 'forbidden' });
  const abort = new AbortController();
  abort.abort();
  await expect(
    generalAnswer(
      client('Answer', () => {
        throw new Error('provider called');
      }),
      'test',
      'Question',
      abort.signal,
      async () => {},
    ),
  ).rejects.toMatchObject({ code: 'cancelled' });
  await expect(
    generalAnswer(client(''), 'test', 'Question', new AbortController().signal, async () => {}),
  ).rejects.toMatchObject({ code: 'invalid_answer' });
});
