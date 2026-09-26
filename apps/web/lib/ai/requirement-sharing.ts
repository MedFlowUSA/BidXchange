import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AiError,
  type AssistantContext,
  type SharedRequirement,
  type RequirementExcerpt,
  type Role,
} from './contracts';

export const requirementExcerptLimit = 1000;
export function canShareRequirement(role: string) {
  return ['organization_admin', 'capture_manager'].includes(role);
}
export function sharingContext(context: AssistantContext | null, shared?: SharedRequirement) {
  return shared
    ? JSON.stringify({ context, requirement: { id: shared.id, updatedAt: shared.updatedAt } })
    : JSON.stringify(context);
}
export async function readSharedRequirement(
  db: SupabaseClient,
  org: string,
  role: Role,
  context: AssistantContext | null,
  mode: 'general' | 'workspace',
  shared?: SharedRequirement,
): Promise<RequirementExcerpt | undefined> {
  if (!shared) return undefined;
  if (
    !shared.consent ||
    mode !== 'workspace' ||
    context?.kind !== 'pursuit' ||
    !canShareRequirement(role)
  )
    throw new AiError('forbidden', 403);
  const { data, error } = await db
    .from('pursuit_requirements')
    .select('id,requirement,updated_at')
    .eq('organization_id', org)
    .eq('pursuit_id', context.id)
    .eq('id', shared.id)
    .is('archived_at', null)
    .maybeSingle();
  if (error) throw new AiError('service_unavailable', 503);
  if (!data) throw new AiError('forbidden', 403);
  if (data.updated_at !== shared.updatedAt) throw new AiError('conversation_changed', 409);
  if (typeof data.requirement !== 'string' || !data.requirement.trim())
    throw new AiError('invalid_request');
  return {
    ...shared,
    text: data.requirement.slice(0, requirementExcerptLimit),
    truncated: data.requirement.length > requirementExcerptLimit,
  };
}
