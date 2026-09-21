import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { accountContext, loadTenant } from '../../../../lib/tenant';
import { responseDocument } from '../../../../lib/response-package';
import {
  renderResponsePdf,
  renderResponseDocx,
  ResponseRenderError,
} from '../../../../lib/response-render';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const input = z
  .object({
    organization: z.uuid(),
    pursuit: z.uuid(),
    package: z.uuid(),
    version: z.iso.datetime({ offset: true }),
    format: z.enum(['pdf', 'docx']),
  })
  .strict();
async function asset(file: string) {
  try {
    return await readFile(path.join(process.cwd(), 'apps/web/public', file));
  } catch {
    return readFile(path.join(process.cwd(), 'public', file));
  }
}
export async function GET(request: Request) {
  const parsed = input.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success)
    return Response.json({ message: 'Invalid export request.' }, { status: 400, headers });
  const v = parsed.data;
  try {
    const account = await accountContext();
    if (!account.user || !account.supabase)
      return Response.json(
        { message: 'Sign in to export this response.' },
        { status: 401, headers },
      );
    if (!account.choices.some((c) => c.id === v.organization))
      return Response.json({ message: 'Response unavailable.' }, { status: 404, headers });
    const db = account.supabase;
    const limit = await db.rpc('consume_admin_mutation');
    if (limit.error || limit.data !== true)
      return Response.json(
        { message: 'Please wait a minute before exporting again.' },
        { status: 429, headers },
      );
    const saved = await db
      .from('proposal_sections')
      .select('id,title,content,status,updated_at')
      .eq('organization_id', v.organization)
      .eq('pursuit_id', v.pursuit)
      .eq('id', v.package)
      .or('title.like.RFI response:%,title.like.RFP response:%,title.like.RFQ response:%')
      .single();
    if (saved.error)
      return Response.json({ message: 'Response unavailable.' }, { status: 404, headers });
    if (saved.data.updated_at !== v.version)
      return Response.json(
        { message: 'The saved draft changed. Reload before exporting.' },
        { status: 409, headers },
      );
    const { data } = await loadTenant(v.organization, `/pursuits/${v.pursuit}`, {
      kind: 'pursuit',
      id: v.pursuit,
    });
    if (!data) return Response.json({ message: 'Response unavailable.' }, { status: 404, headers });
    let document;
    try {
      document = responseDocument(data, v.pursuit, saved.data);
    } catch (e) {
      return Response.json(
        { message: e instanceof Error ? e.message : 'Draft unavailable.' },
        { status: 422, headers },
      );
    }
    const logo = await asset('brand/bidxchange-logo.png');
    const bytes =
      v.format === 'pdf'
        ? await renderResponsePdf(document, {
            logo,
            regular: await asset('fonts/NotoSans-Regular.ttf'),
            bold: await asset('fonts/NotoSans-Bold.ttf'),
          })
        : await renderResponseDocx(document, logo);
    const fresh = await accountContext();
    if (
      !fresh.user ||
      fresh.user.id !== account.user.id ||
      !fresh.choices.some((c) => c.id === v.organization)
    )
      return Response.json(
        { message: 'Access changed. Reload before exporting.' },
        { status: 403, headers },
      );
    const version = await db
      .from('proposal_sections')
      .select('updated_at')
      .eq('organization_id', v.organization)
      .eq('pursuit_id', v.pursuit)
      .eq('id', v.package)
      .single();
    if (version.error || version.data.updated_at !== saved.data.updated_at)
      return Response.json(
        { message: 'The draft changed during export. Reload and retry.' },
        { status: 409, headers },
      );
    if (data.decisionsEnabled) {
      const context = await db.rpc('pursuit_decision_context', {
        org: v.organization,
        pursuit: v.pursuit,
      });
      if (context.error || context.data !== data.decisionContext)
        return Response.json(
          { message: 'Source records changed during export. Reload and retry.' },
          { status: 409, headers },
        );
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        'Content-Type':
          v.format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="bidxchange-response-draft.${v.format}"`,
      },
    });
  } catch (e) {
    return Response.json(
      {
        message:
          e instanceof ResponseRenderError
            ? e.message
            : 'The draft could not be exported. Reload and try again.',
      },
      { status: e instanceof ResponseRenderError ? 422 : 503, headers },
    );
  }
}
