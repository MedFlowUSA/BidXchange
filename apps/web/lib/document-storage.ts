import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { authConfig } from './supabase/config';
export function documentStorage() {
  const config = authConfig(),
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.BIDXCHANGE_DOCUMENTS_ENABLED !== 'true' || !config || !key)
    throw new Error('Documents unavailable');
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
