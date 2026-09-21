import { z } from 'zod';
import { accountContext } from '../../../../lib/tenant';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: Request) {
  if (process.env.BIDXCHANGE_RELEASES_ENABLED !== 'true')
    return Response.json({ message: 'Not activated.' }, { status: 404, headers });
  const parsed = z
    .object({
      organization: z.uuid(),
      release: z.uuid(),
      checksum: z.string().regex(/^[a-f0-9]{64}$/),
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
    const [release, approvals, submissions, followups, status] = await Promise.all([
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
      db.rpc('response_release_status', { org: d.organization, release: d.release }),
    ]);
    if (release.error || approvals.error || submissions.error || followups.error || status.error)
      return Response.json({ message: 'Unavailable.' }, { status: 404, headers });
    if ([approvals, submissions, followups].some((r) => r.data.length > 1000))
      return Response.json(
        { message: 'History exceeds export limit. Request a scoped operations export.' },
        { status: 422, headers },
      );
    const fresh = await accountContext();
    if (fresh.user?.id !== account.user.id || !fresh.choices.some((c) => c.id === d.organization))
      return Response.json({ message: 'Access changed.' }, { status: 403, headers });
    const latest = await db.rpc('response_release_status', {
      org: d.organization,
      release: d.release,
    });
    if (latest.error || JSON.stringify(latest.data) !== JSON.stringify(status.data))
      return Response.json({ message: 'Review state changed; retry.' }, { status: 409, headers });
    const packet = {
      format: 'BidXchange internal handoff v1',
      generated_at: new Date().toISOString(),
      limitations:
        'Internal review packet, not a buyer submission or proof of receipt. Files are external; humans attest that their SHA-256 hashes match this manifest. No portal credentials, file uploads or legal e-signatures.',
      release: release.data,
      readiness: status.data,
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
  } catch {
    return Response.json({ message: 'Handoff unavailable.' }, { status: 503, headers });
  }
}
