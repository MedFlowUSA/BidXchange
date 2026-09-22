'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { accountContext } from '../lib/tenant';
import { responseDraftSchema } from '../lib/response-package';
export type ResponseSaveState = { message: string; success?: boolean; id?: string };
const inputSchema = z.object({
  organization_id: z.uuid(),
  pursuit_id: z.uuid(),
  record_id: z.union([z.uuid(), z.literal('')]),
  version: z.string().max(60),
  title: z.string().trim().min(1).max(160),
  content: z.string().max(100000),
  creation_id: z.uuid().optional(),
});
export async function saveResponsePackage(
  _state: ResponseSaveState,
  form: FormData,
): Promise<ResponseSaveState> {
  const parsed = inputSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { message: 'Check the title and draft length (maximum 100,000 characters).' };
  try {
    const v = parsed.data;
    const draft = responseDraftSchema.parse(JSON.parse(v.content));
    if (Boolean(v.record_id) !== Boolean(v.version))
      return { message: 'Reload the saved draft before editing.' };
    const account = await accountContext();
    if (
      !account.user ||
      !account.supabase ||
      !account.choices.some(
        (c) =>
          c.id === v.organization_id && ['organization_admin', 'capture_manager'].includes(c.role),
      )
    )
      return { message: 'Capture or administrator access is required to save a draft.' };
    const db = account.supabase;
    if (v.creation_id && !v.record_id) {
      const existing = await db
        .from('proposal_sections')
        .select('id,content,status')
        .eq('organization_id', v.organization_id)
        .eq('pursuit_id', v.pursuit_id)
        .eq('id', v.creation_id)
        .maybeSingle();
      if (existing.error)
        return { message: 'Could not check the previous request. Retry shortly.' };
      if (existing.data)
        return existing.data.status === 'draft'
          ? { success: true, id: existing.data.id, message: 'Your draft is already saved.' }
          : { message: 'This request already exists. Open the saved response.' };
    }
    const allowance = await db.rpc('consume_admin_mutation');
    if (allowance.error || allowance.data !== true)
      return { message: 'Please wait a minute before saving again.' };
    const parent = await db
      .from('pursuits')
      .select('id')
      .eq('organization_id', v.organization_id)
      .eq('id', v.pursuit_id)
      .single();
    if (parent.error) return { message: 'The pursuit is unavailable.' };
    const requirements = await db
      .from('pursuit_requirements')
      .select('id,updated_at')
      .eq('organization_id', v.organization_id)
      .eq('pursuit_id', v.pursuit_id)
      .is('archived_at', null)
      .limit(101);
    if (requirements.error || (requirements.data?.length ?? 0) > 100)
      return {
        message: 'This composer supports up to 100 requirements. Review the package scope.',
      };
    if (!v.record_id && !requirements.data?.length)
      return { message: 'Add requirements from the notice before creating a response outline.' };
    if (
      draft.answers.some(
        (a) =>
          !requirements.data.some(
            (r) => r.id === a.requirementId && r.updated_at === a.requirementVersion,
          ),
      )
    )
      return {
        message:
          'A requirement changed or is unavailable. Reload and reconcile your answers. Your draft has been kept.',
      };
    if (process.env.BIDXCHANGE_DECISIONS_ENABLED === 'true') {
      const context = await db.rpc('pursuit_decision_context', {
        org: v.organization_id,
        pursuit: v.pursuit_id,
      });
      if (context.error || context.data !== draft.context)
        return {
          message:
            'The review context changed. Reload and reconcile your answers. Your draft has been kept.',
        };
    } else draft.context = '';
    const values = {
      title: `${draft.kind} response: ${v.title}`,
      content: JSON.stringify(draft),
      status: 'draft',
    };
    const result = v.record_id
      ? await db
          .from('proposal_sections')
          .update(values)
          .eq('organization_id', v.organization_id)
          .eq('pursuit_id', v.pursuit_id)
          .eq('id', v.record_id)
          .eq('updated_at', v.version)
          .or(
            'title.like.RFI response:%,title.like.RFP response:%,title.like.RFQ response:%,title.like.BID response:%,title.like.SOURCES_SOUGHT response:%,title.like.CAPABILITY response:%',
          )
          .eq('status', 'draft')
          .select('id')
      : await db
          .from('proposal_sections')
          .insert({
            ...values,
            ...(v.creation_id ? { id: v.creation_id } : {}),
            organization_id: v.organization_id,
            pursuit_id: v.pursuit_id,
          })
          .select('id');
    if (result.error)
      return { message: 'The response draft could not be saved. Check your access and retry.' };
    if (!result.data?.length)
      return {
        message: 'This saved draft changed. Reload before editing; your text has been kept.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      id: result.data[0].id,
      message: 'Response draft saved. It has not been approved for submission.',
    };
  } catch {
    return { message: 'Check the response fields and your access. The draft could not be saved.' };
  }
}
