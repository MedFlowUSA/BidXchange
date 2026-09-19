import 'server-only';
import { z } from 'zod';
import { createSupabaseServer } from '../supabase/server';
import { AiError, roles, type Role } from './contracts';
export async function authorizeAi(org: string) {
  const db = await createSupabaseServer();
  if (!db) throw new AiError('unauthenticated', 401);
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new AiError('unauthenticated', 401);
  if (!z.uuid().safeParse(org).success) throw new AiError('invalid_request');
  const { data: membership, error: membershipError } = await db
    .from('organization_memberships')
    .select('role,organizations(id,status)')
    .eq('organization_id', org)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  const organization = membership?.organizations as unknown as {
    id: string;
    status: string;
  } | null;
  if (
    membershipError ||
    !membership ||
    !roles.includes(membership.role as Role) ||
    !organization ||
    organization.status === 'suspended'
  )
    throw new AiError('forbidden', 403);
  return { db, user, role: membership.role as Role };
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const allowed =
    process.env.NODE_ENV === 'production'
      ? [process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : '']
      : ['http://127.0.0.1:3000', 'http://localhost:3000'];
  if (!origin || !allowed.includes(origin)) throw new AiError('forbidden', 403);
}
