import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { scanBytes } from './clamd.mjs';
// Run inside the same private host/network as ClamAV. Never expose clamd publicly.
export async function scanPending(db, scan = scanBytes, organizationId) {
  let query = db
    .from('document_versions')
    .select('id,organization_id,sha256,byte_size')
    .eq('scan_status', 'pending')
    .not('uploaded_at', 'is', null)
    .order('created_at')
    .limit(100);
  if (organizationId) query = query.eq('organization_id', organizationId);
  const pending = await query;
  if (pending.error) throw new Error('Scan queue unavailable');
  const results = { scanned: 0, deferred: 0 };
  for (const version of pending.data ?? []) {
    try {
      const file = await db.storage
        .from('company-private')
        .download(
          `${version.organization_id}/${version.id}.pdf`,
          { cacheNonce: randomUUID() },
          { cache: 'no-store' },
        );
      if (file.error || !file.data) throw new Error('Stored file unavailable');
      const bytes = Buffer.from(await file.data.arrayBuffer());
      const valid =
        bytes.length === version.byte_size &&
        bytes.length <= 2097152 &&
        bytes.subarray(0, 5).toString() === '%PDF-' &&
        createHash('sha256').update(bytes).digest('hex') === version.sha256;
      const result = valid
        ? await scan(bytes)
        : { verdict: 'rejected', engine: 'Integrity validation' };
      if (!['clean', 'rejected'].includes(result.verdict)) throw new Error('Invalid verdict');
      const saved = await db.rpc('finish_document_scan', {
        target: version.id,
        expected_hash: version.sha256,
        verdict: result.verdict,
        engine: result.engine,
      });
      if (saved.error) throw new Error('Scan result not saved');
      if (saved.data) results.scanned++;
    } catch {
      results.deferred++;
    }
  }
  return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw new Error('Worker not configured');
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.log(
      JSON.stringify(
        await scanPending(db, (bytes) =>
          scanBytes(bytes, {
            host: process.env.CLAMD_HOST || '127.0.0.1',
            port: Number(process.env.CLAMD_PORT || 3310),
          }),
        ),
      ),
    );
  } catch {
    console.error('Document scanning unavailable');
    process.exitCode = 1;
  }
}
