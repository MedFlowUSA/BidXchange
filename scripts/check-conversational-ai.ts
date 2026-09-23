// Opt-in release check executed inside Vercel. Uses fictional records only;
// credentials, prompts, answers and customer data never enter build logs.
import OpenAI from 'openai';
import assert from 'node:assert/strict';
import { runAssistant } from '../apps/web/lib/ai/engine';
import type { EvidenceTools } from '../apps/web/lib/ai/tools';
import type { Evidence } from '../apps/web/lib/ai/contracts';
import type { ChatTurn } from '../apps/web/lib/ai/conversation';

async function check() {
  assert.equal(process.env.VERCEL_ENV, 'production');
  assert(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 45000 });
  const record: Evidence = {
    citation: {
      key: 'fact:11111111-1111-4111-8111-111111111111',
      type: 'fact',
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Fictional service territory',
      status: 'needs_review',
      sourceDate: null,
      updatedAt: '2026-09-22',
      href: null,
    },
    fields: {
      label: 'Service territory',
      value:
        'Fictional Redwood Electric serves Redlands and Riverside. This is an unreviewed claim, not proof of eligibility.',
    },
  };
  const makeTools = () =>
    ({
      evidence: new Map([[record.citation.key, record]]),
      async run(name: string) {
        if (name === 'get_workspace_summary')
          return { fictional: true, name: 'Fictional Redwood Electric', liveFeeds: false };
        if (
          [
            'search_company_records',
            'get_authorized_company_facts',
            'get_company_readiness',
          ].includes(name)
        )
          return { records: [record], nextOffset: null };
        return { records: [], notice: 'Not found in the fictional test records.' };
      },
    }) as unknown as EvidenceTools;
  const history: ChatTurn[] = [];
  let inputTokens = 0,
    outputTokens = 0;
  for (const [mode, question] of [
    [
      'workspace',
      'Use the saved service territory to suggest a practical two-step weekly bid-review plan. Explain the basis. Do not search the web.',
    ],
    [
      'workspace',
      'Turn that plan into a short draft email to Donn. Refer to the territory discussed and suggest our next meeting.',
    ],
    [
      'general',
      'Explain the difference between a bid bond and a performance bond in plain English.',
    ],
  ] as const) {
    const result = await runAssistant(
      client,
      process.env.OPENAI_MODEL!,
      question,
      null,
      makeTools(),
      AbortSignal.timeout(45000),
      () => {},
      async () => {},
      mode,
      mode === 'workspace' ? history : [],
    );
    const prose = result.answer.answer.map((x) => x.text).join('\n');
    assert(prose.length > 100);
    if (!history.length) assert(result.answer.citations.some((c) => c.key === record.citation.key));
    if (history.length === 1) assert(/Donn/i.test(prose) && /Redlands|Riverside/i.test(prose));
    if (mode === 'general') assert.equal(result.answer.citations.length, 0);
    history.push({ question, answer: prose });
    inputTokens += result.inputTokens;
    outputTokens += result.outputTokens;
  }
  console.log(
    JSON.stringify({
      event: 'conversational_ai_release_check',
      success: true,
      checks: 3,
      syntheticOnly: true,
      inputTokens,
      outputTokens,
    }),
  );
}
if (process.env.BIDXCHANGE_AI_RELEASE_CHECK === 'true') {
  check().catch(() => {
    console.error(
      JSON.stringify({
        event: 'conversational_ai_release_check',
        success: false,
        details: 'Provider or response check failed; no private values logged.',
      }),
    );
    process.exitCode = 1;
  });
}
