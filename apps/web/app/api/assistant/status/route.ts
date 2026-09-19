import { authorizeAi } from '../../../../lib/ai/server';
import { aiConfig } from '../../../../lib/ai/config';
export async function GET(request: Request) {
  try {
    const { db, user, role } = await authorizeAi(
      new URL(request.url).searchParams.get('organization') ?? '',
    );
    const { data, error } = await db
      .from('ai_organization_settings')
      .select('enabled')
      .eq('organization_id', new URL(request.url).searchParams.get('organization')!)
      .maybeSingle();
    return Response.json(
      { available: !!aiConfig() && !error && data?.enabled === true, access: `${user.id}:${role}` },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return Response.json(
      { available: false },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
