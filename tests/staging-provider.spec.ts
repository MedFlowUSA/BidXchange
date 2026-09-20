import { test, expect } from '@playwright/test';
import { stagingConfig } from '../apps/web/lib/ai/staging-provider';
test('staging mock fails closed outside its isolated keyless Preview', () => {
  const env = {
    VERCEL_ENV: 'preview',
    SUPABASE_URL: 'https://svimdvbgtltmyaubfaux.supabase.co',
    SITE_URL: 'https://bidxchange-staging.vercel.app',
    BIDXCHANGE_AI_STAGING_TEST_ENABLED: 'true',
    BIDXCHANGE_AI_ENABLED: 'false',
  };
  expect(stagingConfig(env)?.model).toBe('deterministic-staging-mock');
  for (const change of [
    { VERCEL_ENV: 'production' },
    { SUPABASE_URL: 'https://other.supabase.co' },
    { SITE_URL: 'https://bidxapp.vercel.app' },
    { BIDXCHANGE_AI_STAGING_TEST_ENABLED: 'false' },
    { BIDXCHANGE_AI_ENABLED: 'true' },
    { OPENAI_API_KEY: 'synthetic-placeholder' },
  ])
    expect(stagingConfig({ ...env, ...change })).toBeNull();
});
