'use server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../lib/tenant';
import { documentStorage } from '../lib/document-storage';
import { documentObjectPath, maxDocumentBytes, validDocumentBytes } from '../lib/document-files';
import type { MutationState } from './actions';
const unavailable = { message: 'Document not saved. Check your access and fields, then retry.' };
export async function uploadDocument(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const input = z
    .object({
      organization_id: z.uuid(),
      document_id: z.union([z.uuid(), z.literal('')]),
      title: z.string().trim().min(1).max(200),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success || process.env.BIDXCHANGE_DOCUMENTS_ENABLED !== 'true') return unavailable;
  try {
    const { supabase } = await requireAdmin(input.data.organization_id);
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      file.size > maxDocumentBytes ||
      file.size < 9 ||
      file.type !== 'application/pdf'
    )
      return { message: 'Choose a PDF no larger than 2 MB.' };
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validDocumentBytes(bytes))
      return { message: 'The file does not have a supported PDF header.' };
    const storage = documentStorage();
    const reservation = await supabase.rpc('reserve_document_version', {
      org: input.data.organization_id,
      existing_document: input.data.document_id || null,
      document_title: input.data.title,
      content_hash: createHash('sha256').update(bytes).digest('hex'),
      content_size: bytes.length,
    });
    if (reservation.error || !z.uuid().safeParse(reservation.data).success) return unavailable;
    // No overwrite or signed upload capability reaches the browser.
    const uploaded = await storage.storage
      .from('company-private')
      .upload(documentObjectPath(input.data.organization_id, reservation.data), bytes, {
        contentType: 'application/pdf',
        upsert: false,
      });
    if (uploaded.error)
      return {
        message:
          'Upload did not complete. Its reserved version remains unavailable; retry creates a new version.',
      };
    const confirmed = await storage.rpc('confirm_document_upload', {
      target: reservation.data,
      expected_hash: createHash('sha256').update(bytes).digest('hex'),
    });
    if (confirmed.error || confirmed.data !== true)
      return {
        message:
          'File stored but not queued. Contact the administrator; this version remains unavailable.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message:
        'PDF received and awaiting scanning. It cannot be downloaded or cited until the scan passes.',
    };
  } catch {
    return unavailable;
  }
}
export async function linkDocument(_state: MutationState, form: FormData): Promise<MutationState> {
  const input = z
    .object({
      organization_id: z.uuid(),
      requirement_id: z.uuid(),
      updated_at: z.iso.datetime({ offset: true }),
      document_version_id: z.uuid(),
      source_reference: z.string().trim().min(1).max(2000),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success || process.env.BIDXCHANGE_DOCUMENTS_ENABLED !== 'true') return unavailable;
  try {
    const { supabase } = await requireAdmin(input.data.organization_id);
    const result = await supabase.rpc('link_requirement_document', {
      org: input.data.organization_id,
      target_requirement: input.data.requirement_id,
      expected_version: input.data.updated_at,
      source_version: input.data.document_version_id,
      reference: input.data.source_reference,
    });
    if (result.error)
      return {
        message:
          'Reference not saved. The requirement may have changed, or the scanned version is unavailable. Your draft is kept.',
      };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message: 'Version reference saved. Review the requirement and prior approvals again.',
    };
  } catch {
    return unavailable;
  }
}
