import { authorizeAi } from '../../../../lib/ai/server';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const org = new URL(request.url).searchParams.get('organization') ?? '';
    const { db, role } = await authorizeAi(org);
    if (role !== 'organization_admin')
      return Response.json({ available: false }, { status: 403, headers });
    const today = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';
    const { count, error } = await db
      .from('ai_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org)
      .gte('created_at', today);
    return Response.json(
      { available: !error, reservations: count ?? 0, day: today.slice(0, 10) },
      { headers },
    );
  } catch {
    return Response.json({ available: false }, { status: 403, headers });
  }
}
