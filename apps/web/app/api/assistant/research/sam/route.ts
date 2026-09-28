import OpenAI from 'openai';
import { aiConfig } from '../../../../../lib/ai/config';
import { authorizeAi, requireSameOrigin } from '../../../../../lib/ai/server';
import { planResearch } from '../../../../../lib/research/planner';
import { samHandlers } from '../../../../../lib/research/sam-handler';

export const runtime = 'nodejs';
export const maxDuration = 60;
const handlers = samHandlers({
  authorize: authorizeAi,
  sameOrigin: requireSameOrigin,
  config: aiConfig,
  samKey: () =>
    process.env.BIDXCHANGE_SAM_SEARCH_ENABLED === 'true' && process.env.SAM_GOV_API_KEY?.trim()
      ? process.env.SAM_GOV_API_KEY.trim()
      : null,
  plan: (prompt, now, signal) => {
    const config = aiConfig()!;
    return planResearch(
      new OpenAI({ apiKey: config.key, maxRetries: 0, timeout: 30000 }),
      config.model,
      prompt,
      null,
      now,
      signal,
    );
  },
});
export const GET = handlers.GET;
export const POST = handlers.POST;
