import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { authConfig } from './supabase/config';

export function demoIntakeConfig() {
  const url = authConfig()?.url;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hashKey = process.env.BIDXCHANGE_INTAKE_HASH_KEY;
  if (
    process.env.BIDXCHANGE_DEMO_INTAKE_ENABLED !== 'true' ||
    !url ||
    !key ||
    !hashKey ||
    hashKey.length < 32 ||
    process.env.VERCEL !== '1'
  )
    return null;
  return { url, key, hashKey };
}

export function intakeDatabase(config: NonNullable<ReturnType<typeof demoIntakeConfig>>) {
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
