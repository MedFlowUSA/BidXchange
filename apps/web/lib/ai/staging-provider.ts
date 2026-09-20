// STAGING BRANCH ONLY. No provider SDK or network implementation.
import type { ModelClient } from './engine';
export function stagingConfig(env: NodeJS.ProcessEnv) {
  if (
    env.VERCEL_ENV !== 'preview' ||
    env.SUPABASE_URL !== 'https://svimdvbgtltmyaubfaux.supabase.co' ||
    env.SITE_URL !== 'https://bidxchange-staging.vercel.app' ||
    env.BIDXCHANGE_AI_STAGING_TEST_ENABLED !== 'true' ||
    env.BIDXCHANGE_AI_ENABLED !== 'false' ||
    env.OPENAI_API_KEY
  )
    return null;
  return {
    key: 'synthetic-staging-digest-only',
    model: 'deterministic-staging-mock',
    orgLimit: 20,
    userLimit: 5,
  };
}
export function stagingProvider(): ModelClient {
  if (!stagingConfig(process.env)) throw new Error('Staging provider disabled');
  return {
    responses: {
      create: async (
        body: {
          input: Array<{ type?: string; role?: string; content?: unknown; output?: string }>;
        },
        options: { signal: AbortSignal },
      ) => ({
        async *[Symbol.asyncIterator]() {
          const prompt = String(body.input.find((x) => x.role === 'user')?.content ?? '');
          if (prompt === 'STAGING_TEST_FAILURE') throw new Error('Synthetic provider outage');
          if (prompt.startsWith('STAGING_TEST_SLOW')) {
            await new Promise<void>((resolve, reject) => {
              const abort = () => {
                clearTimeout(timer);
                reject(new Error('Synthetic cancellation'));
              };
              const timer = setTimeout(() => {
                options.signal.removeEventListener('abort', abort);
                resolve();
              }, 5000);
              if (options.signal.aborted) abort();
              else options.signal.addEventListener('abort', abort, { once: true });
            });
          }
          const output = body.input.find((x) => x.type === 'function_call_output');
          if (!output) {
            yield {
              type: 'response.completed',
              response: {
                output: [
                  {
                    type: 'function_call',
                    name: 'get_authorized_company_facts',
                    arguments: '{}',
                    call_id: 'synthetic-read',
                  },
                ],
                usage: { input_tokens: 0, output_tokens: 0 },
              },
            };
          } else {
            const records = JSON.parse(output.output ?? '[]') as Array<{
              citation: { key: string };
            }>;
            yield {
              type: 'response.completed',
              response: {
                output: [
                  {
                    type: 'message',
                    content: [
                      {
                        type: 'output_text',
                        text: JSON.stringify({
                          answer: records
                            .slice(0, 8)
                            .map((r) => ({
                              text: 'Synthetic evidence selection',
                              sources: [r.citation.key],
                            })),
                          risks: [],
                          nextAction: 'Human review',
                        }),
                      },
                    ],
                  },
                ],
                usage: { input_tokens: 0, output_tokens: 0 },
              },
            };
          }
        },
      }),
    },
  } as unknown as ModelClient;
}
