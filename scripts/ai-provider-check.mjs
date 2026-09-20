import OpenAI from 'openai';
// Temporary opt-in deployment check. Never logs keys, prompts or tenant data.
if (process.env.BIDXCHANGE_AI_PROVIDER_CHECK === 'true') {
  try {
    if (process.env.VERCEL_ENV !== 'production' || !process.env.OPENAI_API_KEY)
      throw new Error('configuration');
    const result = await new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 15000,
    }).responses.create({
      model: 'gpt-5.6-luna',
      input: 'Reply with OK.',
      store: false,
      reasoning: { effort: 'none' },
      max_output_tokens: 32,
    });
    if (result.output_text?.trim() !== 'OK') throw new Error('unexpected_output');
    console.log(
      JSON.stringify({
        event: 'ai_activation_check',
        success: true,
        inputTokens: result.usage?.input_tokens,
        outputTokens: result.usage?.output_tokens,
        tenantDataSent: false,
      }),
    );
  } catch (error) {
    const reason =
      error?.status === 401
        ? 'invalid_api_key'
        : error?.status === 429
          ? 'quota_or_rate_limit'
          : error?.status === 403
            ? 'permission_denied'
            : error?.status === 404
              ? 'model_unavailable'
              : 'configuration_or_provider_failure';
    console.error(JSON.stringify({ event: 'ai_activation_check', success: false, reason }));
    process.exitCode = 1;
  }
}
