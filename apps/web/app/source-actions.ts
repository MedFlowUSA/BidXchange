'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import { searchFilters } from '../lib/sources/contracts';
import type { MutationState } from './actions';

async function access(org: string) {
  if (process.env.BIDXCHANGE_SOURCES_ENABLED !== 'true' || !z.uuid().safeParse(org).success)
    throw new Error('disabled');
  const account = await accountContext();
  if (
    !account.user ||
    !account.supabase ||
    !account.choices.some(
      (c) => c.id === org && ['organization_admin', 'capture_manager'].includes(c.role),
    )
  )
    throw new Error('access');
  return account.supabase;
}
export async function saveSourceSearch(_: MutationState, form: FormData): Promise<MutationState> {
  try {
    const org = String(form.get('organization_id'));
    const db = await access(org);
    const filters = searchFilters.parse(JSON.parse(String(form.get('filters'))));
    const result = await db.rpc('save_opportunity_search', {
      org,
      search_id: z
        .uuid()
        .nullable()
        .parse(form.get('id') || null),
      expected: z.iso
        .datetime({ offset: true })
        .nullable()
        .parse(form.get('updated_at') || null),
      search_name: z.string().trim().min(1).max(120).parse(form.get('name')),
      search_filters: filters,
      activate: form.get('activate') === 'on',
    });
    if (result.error) throw new Error('save');
    revalidatePath('/opportunities/sources');
    return {
      success: true,
      message:
        'Search saved. Activation records your review of these filters; it does not establish eligibility.',
    };
  } catch {
    return {
      message:
        'Could not save. Check fields and access, or reload if this search changed. Your draft remains here.',
    };
  }
}
export async function reviewSource(_: MutationState, form: FormData): Promise<MutationState> {
  try {
    const org = String(form.get('organization_id'));
    const db = await access(org);
    const result = await db.rpc('review_source_item', {
      org,
      item: z.uuid().parse(form.get('id')),
      expected: z.iso.datetime({ offset: true }).parse(form.get('updated_at')),
      expected_version: z.uuid().parse(form.get('version')),
      disposition: z
        .enum(['needs_review', 'saved', 'dismissed', 'converted'])
        .parse(form.get('disposition')),
      reason: z.string().trim().min(1).max(2000).parse(form.get('reason')),
      reviewer: z
        .uuid()
        .nullable()
        .parse(form.get('reviewer') || null),
      confirm_conversion: form.get('confirm') === 'on',
    });
    if (result.error) throw new Error('save');
    revalidatePath('/', 'layout');
    return {
      success: true,
      message: 'Review saved. No pursuit or bid decision was created.',
      ...(result.data ? { href: `/opportunities/${result.data}?organization=${org}` } : {}),
    };
  } catch {
    return {
      message:
        'Could not save. Reload to check source changes and access. Your draft remains here.',
    };
  }
}
