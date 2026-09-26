import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AiError,
  type AssistantContext,
  type SharedRequirement,
  type RequirementExcerpt,
  type Role,
  reviewSelectionSchema,
} from './contracts';

export const requirementExcerptLimit = 1000;
export const reviewExcerptLimit = 4000;
export const reviewTotalLimit = 20000;
export function canShareRequirement(role: string) {
  return ['organization_admin', 'capture_manager'].includes(role);
}
export function sharingContext(
  context: AssistantContext | null,
  shared?: SharedRequirement | SharedRequirement[],
) {
  if (Array.isArray(shared))
    return JSON.stringify({
      context,
      requirements: [...shared]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(({ id, updatedAt }) => ({ id, updatedAt })),
    });
  return shared
    ? JSON.stringify({ context, requirement: { id: shared.id, updatedAt: shared.updatedAt } })
    : JSON.stringify(context);
}

export async function readSharedRequirements(
  db: SupabaseClient,
  org: string,
  role: Role,
  context: AssistantContext | null,
  mode: 'general' | 'workspace',
  selection?: SharedRequirement[],
): Promise<RequirementExcerpt[] | undefined> {
  if (!selection) return undefined;
  if (!reviewSelectionSchema.safeParse(selection).success) throw new AiError('invalid_request');
  if (mode !== 'workspace' || context?.kind !== 'pursuit' || !canShareRequirement(role))
    throw new AiError('forbidden', 403);
  const { data, error } = await db
    .from('pursuit_requirements')
    .select('id,requirement,updated_at')
    .eq('organization_id', org)
    .eq('pursuit_id', context.id)
    .is('archived_at', null)
    .in(
      'id',
      selection.map((item) => item.id),
    );
  if (error) throw new AiError('service_unavailable', 503);
  if (!data || data.length !== selection.length) throw new AiError('forbidden', 403);
  const excerpts = selection.map((item) => {
    const row = data.find((r) => r.id === item.id);
    if (!row) throw new AiError('forbidden', 403);
    if (row.updated_at !== item.updatedAt) throw new AiError('conversation_changed', 409);
    if (typeof row.requirement !== 'string' || !row.requirement.trim())
      throw new AiError('invalid_request');
    return {
      ...item,
      text: row.requirement.slice(0, reviewExcerptLimit),
      truncated: row.requirement.length > reviewExcerptLimit,
    };
  });
  if (excerpts.reduce((total, item) => total + item.text.length, 0) > reviewTotalLimit)
    throw new AiError('invalid_request');
  return excerpts;
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
