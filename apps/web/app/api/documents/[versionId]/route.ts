import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { accountContext } from '../../../../lib/tenant';
import { documentStorage } from '../../../../lib/document-storage';
import { documentObjectPath } from '../../../../lib/document-files';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const denied = () => new Response('Document unavailable', { status: 404, headers });
export async function GET(request: Request, context: { params: Promise<{ versionId: string }> }) {
  if (process.env.BIDXCHANGE_DOCUMENTS_ENABLED !== 'true') return denied();
  const { versionId } = await context.params;
  const organization = new URL(request.url).searchParams.get('organization');
  if (!z.uuid().safeParse(versionId).success || !z.uuid().safeParse(organization).success)
    return denied();
  try {
    const account = await accountContext();
    if (!account.user || !account.supabase) return denied();
    const read = () =>
      account
        .supabase!.from('document_versions')
        .select('id,sha256,byte_size,scan_status')
        .eq('organization_id', organization!)
        .eq('id', versionId)
        .maybeSingle();
    const initial = await read();
    if (initial.error || initial.data?.scan_status !== 'clean') return denied();
    const object = await documentStorage()
      .storage.from('company-private')
      .download(
        documentObjectPath(organization!, versionId),
        { cacheNonce: randomUUID() },
        { cache: 'no-store' },
      );
    if (object.error || !object.data || object.data.size !== initial.data.byte_size)
      return denied();
    const bytes = new Uint8Array(await object.data.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== initial.data.sha256) return denied();
    // Reauthorize after the storage fetch, before releasing any content.
    const current = await read();
    if (current.error || current.data?.scan_status !== 'clean') return denied();
    return new Response(bytes, {
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="document-${versionId}.pdf"`,
        'Content-Security-Policy': "sandbox; default-src 'none'",
      },
    });
  } catch {
    return denied();
  }
}
