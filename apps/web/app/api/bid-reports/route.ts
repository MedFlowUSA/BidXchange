import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { accountContext, loadTenant } from '../../../lib/tenant';
import { bidReport, BidReportError, canIncludeRestricted } from '../../../lib/bid-report';
import { renderResponsePdf, ResponseRenderError } from '../../../lib/response-render';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const input = z
  .object({
    organization: z.uuid(),
    pursuit: z.uuid(),
    package: z.uuid().optional(),
    version: z.iso.datetime({ offset: true }).optional(),
    restricted: z.enum(['true', 'false']).default('false'),
  })
  .strict()
  .refine((v) => !!v.package === !!v.version);
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
    return Response.json({ message: 'Invalid bid report request.' }, { status: 400, headers });
  const v = parsed.data;
  try {
    const account = await accountContext();
    if (!account.user || !account.supabase)
      return Response.json(
        { message: 'Sign in to download a bid report.' },
        { status: 401, headers },
      );
    const membership = account.choices.find((c) => c.id === v.organization);
    if (!membership)
      return Response.json({ message: 'Bid unavailable.' }, { status: 404, headers });
    if (v.restricted === 'true' && !canIncludeRestricted(membership.role))
      return Response.json(
        { message: 'Your role cannot include restricted company records.' },
        { status: 403, headers },
      );
    const limit = await account.supabase.rpc('consume_admin_mutation');
    if (limit.error || limit.data !== true)
      return Response.json(
        { message: 'Please wait a minute before exporting again.' },
        { status: 429, headers },
      );
    const exists = await account.supabase
      .from('pursuits')
      .select('id')
      .eq('organization_id', v.organization)
      .eq('id', v.pursuit)
      .maybeSingle();
    if (exists.error || !exists.data)
      return Response.json({ message: 'Bid unavailable.' }, { status: 404, headers });
    const load = async () => {
      const result = await loadTenant(v.organization, `/pursuits/${v.pursuit}`, {
        kind: 'pursuit',
        id: v.pursuit,
      });
      const profile = await account
        .supabase!.from('company_profiles')
        .select('id,summary,updated_at')
        .eq('organization_id', v.organization)
        .maybeSingle();
      if (profile.error) throw new Error('Company profile unavailable.');
      if (result.data) result.data.companyProfile = profile.data;
      return result;
    };
    const loaded = await load(),
      data = loaded.data;
    if (
      !data ||
      data.organization.id !== v.organization ||
      data.userId !== account.user.id ||
      data.organization.role !== membership.role
    )
      return Response.json(
        { message: 'Access changed. Reload before exporting.' },
        { status: 403, headers },
      );
    const selection = {
      packageId: v.package,
      version: v.version,
      restricted: v.restricted === 'true',
    };
    const now = new Date(),
      document = bidReport(data, v.pursuit, selection, now);
    const pdf = await renderResponsePdf(
      document,
      {
        logo: await asset('brand/bidxchange-logo.png'),
        regular: await asset('fonts/NotoSans-Regular.ttf'),
        bold: await asset('fonts/NotoSans-Bold.ttf'),
      },
      'report',
    );
    const fresh = await accountContext();
    if (
      fresh.user?.id !== account.user.id ||
      !fresh.choices.some((c) => c.id === v.organization && c.role === membership.role)
    )
      return Response.json(
        { message: 'Access changed. Reload before exporting.' },
        { status: 403, headers },
      );
    const refreshed = await load();
    if (
      !refreshed.data ||
      refreshed.data.userId !== account.user.id ||
      refreshed.data.organization.id !== v.organization ||
      refreshed.data.organization.role !== membership.role
    )
      return Response.json(
        { message: 'Access changed. Reload before exporting.' },
        { status: 403, headers },
      );
    let unchanged = false;
    try {
      unchanged =
        JSON.stringify(bidReport(refreshed.data, v.pursuit, selection, now)) ===
        JSON.stringify(document);
    } catch {
      /* A removed draft or newly incomplete source set invalidates the export. */
    }
    if (!unchanged)
      return Response.json(
        { message: 'Company or bid records changed during export. Reload and try again.' },
        { status: 409, headers },
      );
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bidxchange-bid-report-${v.pursuit.slice(0, 8)}.pdf"`,
      },
    });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof BidReportError || error instanceof ResponseRenderError
            ? error.message
            : 'The bid report could not be generated. Reload and try again.',
      },
      {
        status: error instanceof BidReportError || error instanceof ResponseRenderError ? 422 : 503,
        headers,
      },
    );
  }
}
