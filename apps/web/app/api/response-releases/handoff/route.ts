import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { accountContext } from '../../../../lib/tenant';
import { handoffDocument } from '../../../../lib/handoff-document';
import { renderResponsePdf, ResponseRenderError } from '../../../../lib/response-render';
import { releaseHandoff } from '../../../../lib/submission-handoff';
import { releaseChecklist } from '../../../../lib/response-release';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
async function asset(file: string) {
  try {
    return await readFile(path.join(process.cwd(), 'apps/web/public', file));
  } catch {
    return readFile(path.join(process.cwd(), 'public', file));
  }
}
export async function GET(request: Request) {
  if (process.env.BIDXCHANGE_RELEASES_ENABLED !== 'true')
    return Response.json({ message: 'Not activated.' }, { status: 404, headers });
  const parsed = z
    .object({
      organization: z.uuid(),
      release: z.uuid(),
      checksum: z.string().regex(/^[a-f0-9]{64}$/),
      format: z.enum(['json', 'pdf']).default('json'),
    })
    .strict()
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success)
    return Response.json({ message: 'Invalid handoff request.' }, { status: 400, headers });
  try {
    const d = parsed.data,
      account = await accountContext();
    if (!account.user || !account.supabase)
      return Response.json({ message: 'Sign in required.' }, { status: 401, headers });
    if (!account.choices.some((c) => c.id === d.organization))
      return Response.json({ message: 'Unavailable.' }, { status: 404, headers });
    const db = account.supabase;
    const limit = await db.rpc('consume_admin_mutation');
    if (limit.error || limit.data !== true)
      return Response.json(
        { message: 'Please wait a minute before exporting again.' },
        { status: 429, headers },
      );
    // Read the revision before histories so any concurrent append is detected after rendering.
    const status = await db.rpc('response_release_status', {
      org: d.organization,
      release: d.release,
    });
    if (status.error) return Response.json({ message: 'Unavailable.' }, { status: 404, headers });
    const [release, approvals, submissions, followups] = await Promise.all([
      db
        .from('response_release_versions')
        .select('*')
        .eq('organization_id', d.organization)
        .eq('id', d.release)
        .eq('checksum', d.checksum)
        .single(),
      db
        .from('response_approval_history')
        .select('*')
        .eq('organization_id', d.organization)
        .eq('release_id', d.release)
        .order('sequence')
        .limit(1001),
      db
        .from('response_submission_history')
        .select('*')
        .eq('organization_id', d.organization)
        .eq('release_id', d.release)
        .order('sequence')
        .limit(1001),
      db
        .from('response_followup_history')
        .select('*')
        .eq('organization_id', d.organization)
        .eq('release_id', d.release)
        .order('sequence')
        .limit(1001),
    ]);
    if (release.error || approvals.error || submissions.error || followups.error || status.error)
      return Response.json({ message: 'Unavailable.' }, { status: 404, headers });
    if ([approvals, submissions, followups].some((r) => r.data.length > 1000))
      return Response.json(
        { message: 'History exceeds export limit. Request a scoped operations export.' },
        { status: 422, headers },
      );
    const generatedAt = new Date().toISOString();
    const preparation = releaseHandoff(
      releaseChecklist.parse(release.data.snapshot.checklist),
      d.checksum,
      status.data,
    );
    const pdf =
      d.format === 'pdf'
        ? await renderResponsePdf(
            handoffDocument(
              release.data,
              status.data,
              approvals.data,
              submissions.data,
              generatedAt,
            ),
            {
              logo: await asset('brand/bidxchange-logo.png'),
              regular: await asset('fonts/NotoSans-Regular.ttf'),
              bold: await asset('fonts/NotoSans-Bold.ttf'),
            },
            'handoff',
          )
        : null;
    const fresh = await accountContext();
    if (
      fresh.user?.id !== account.user.id ||
      !fresh.choices.some(
        (c) =>
          c.id === d.organization &&
          c.role === account.choices.find((original) => original.id === d.organization)?.role,
      )
    )
      return Response.json({ message: 'Access changed.' }, { status: 403, headers });
    const latest = await fresh.supabase?.rpc('response_release_status', {
      org: d.organization,
      release: d.release,
    });
    if (!latest || latest.error || JSON.stringify(latest.data) !== JSON.stringify(status.data))
      return Response.json({ message: 'Review state changed; retry.' }, { status: 409, headers });
    if (pdf)
      return new Response(new Uint8Array(pdf), {
        headers: {
          ...headers,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="bidxchange-handoff-v${release.data.sequence}.pdf"`,
        },
      });
    const packet = {
      format: 'BidXchange internal handoff v1',
      generated_at: generatedAt,
      limitations:
        'Internal review packet, not a buyer submission or proof of receipt. Files are external; humans attest that their SHA-256 hashes match this manifest. No portal credentials, file uploads or legal e-signatures.',
      release: release.data,
      readiness: status.data,
      handoff: preparation,
      approvals: approvals.data,
      submission_records: submissions.data,
      followups: followups.data,
    };
    return new Response(JSON.stringify(packet, null, 2), {
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="bidxchange-handoff-${d.release}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof ResponseRenderError || error instanceof z.ZodError)
      return Response.json(
        {
          message:
            error instanceof ResponseRenderError
              ? error.message
              : 'This packet exceeds PDF limits or has unsupported historical fields. Use JSON for the full record.',
        },
        { status: 422, headers },
      );
    return Response.json({ message: 'Handoff unavailable.' }, { status: 503, headers });
  }
}
