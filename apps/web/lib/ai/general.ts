import type OpenAI from 'openai';
import type { Response } from 'openai/resources/responses/responses';
import { AiError, LIMITS, type Answer } from './contracts';

export async function generalAnswer(
  client: Pick<OpenAI, 'responses'>,
  model: string,
  prompt: string,
  signal: AbortSignal,
  authorize: () => Promise<void>,
): Promise<{ answer: Answer; inputTokens: number; outputTokens: number }> {
  if (signal.aborted) throw new AiError('cancelled', 499);
  await authorize();
  const stream = await client.responses.create(
    {
      model,
      store: false,
      stream: true,
      max_output_tokens: LIMITS.outputTokens,
      instructions: `You are BidXchange's general assistant. Answer the user's question helpfully and directly: explanations, writing, brainstorming, planning, coding, and general knowledge are welcome. You have no access to company records, files, live websites, or external actions in this mode. Do not invent company details, citations, current news, prices, laws or procurement results. When current information is needed, explain that it requires verification. If asked about saved company records, direct the user to Workspace records mode. You may help draft or reason, but never claim to approve bids, verify qualifications, send messages, or submit anything. Distinguish user-provided assumptions from verified facts. Give appropriate uncertainty for high-stakes questions. Use plain text and concise paragraphs; never claim that your response is a verified record.`,
      input: [{ role: 'user', content: prompt }],
    },
    { signal },
  );
  let response: Response | undefined;
  for await (const event of stream) {
    if (event.type === 'response.completed') response = event.response;
    if (['response.failed', 'response.incomplete', 'error'].includes(event.type))
      throw new AiError('service_unavailable', 503);
  }
  if (!response || response.output.some((item) => item.type === 'function_call'))
    throw new AiError('invalid_answer', 502);
  const text = response.output
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content)
    .flatMap((item) =>
      item.type === 'output_text' ? [item.text] : item.type === 'refusal' ? [item.refusal] : [],
    )
    .join('\n')
    .trim();
  if (!text || text.length > 16000) throw new AiError('invalid_answer', 502);
  await authorize();
  if (signal.aborted) throw new AiError('cancelled', 499);
  return {
    answer: {
      answer: [{ text, sources: [] }],
      risks: [],
      nextAction: '',
      citations: [],
      evidence: [],
      notice: 'General AI response. No company records or live web sources were used.',
    },
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}
