import 'server-only';
export function aiConfig() {
  const env = process.env;
  const orgLimit = Number(env.BIDXCHANGE_AI_DAILY_ORG_LIMIT),
    userLimit = Number(env.BIDXCHANGE_AI_DAILY_USER_LIMIT);
  if (
    env.BIDXCHANGE_AI_ENABLED !== 'true' ||
    !env.OPENAI_API_KEY ||
    !env.OPENAI_MODEL?.trim() ||
    !Number.isInteger(orgLimit) ||
    orgLimit < 1 ||
    orgLimit > 1000 ||
    !Number.isInteger(userLimit) ||
    userLimit < 1 ||
    userLimit > 100
  )
    return null;
  return { key: env.OPENAI_API_KEY, model: env.OPENAI_MODEL.trim(), orgLimit, userLimit };
}
