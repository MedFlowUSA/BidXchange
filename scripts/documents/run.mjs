import { createClient } from '@supabase/supabase-js';
import { scanPending } from './worker.mjs';
import { scanBytes } from './clamd.mjs';
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error('Worker configuration missing');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
while (!stopping) {
  try {
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        ...(await scanPending(db, (bytes) => scanBytes(bytes, { host: 'clamav', port: 3310 }))),
      }),
    );
  } catch {
    console.error('Document scan queue unavailable');
  }
  if (!stopping) await new Promise((resolve) => setTimeout(resolve, 15000));
}
