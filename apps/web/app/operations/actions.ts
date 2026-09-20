'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '../../lib/supabase/server';

export async function reviewDemoRequest(_state: { message: string }, form: FormData) {
  try {
    const input = z
      .object({
        id: z.uuid(),
        version: z.coerce.number().int().positive(),
        status: z.enum(['new', 'contacted', 'qualified', 'closed', 'erase']),
        confirm: z.string().optional(),
      })
      .parse(Object.fromEntries(form));
    const db = await createSupabaseServer();
    if (!db || !(await db.auth.getUser()).data.user) return { message: 'Sign in to continue.' };
    if (input.status === 'erase' && input.confirm !== 'yes')
      return { message: 'Confirm erasure before removing this request.' };
    const result =
      input.status === 'erase'
        ? await db.rpc('erase_demo_request', { p_id: input.id, p_version: input.version })
        : await db.rpc('review_demo_request', {
            p_id: input.id,
            p_version: input.version,
            p_status: input.status,
          });
    if (result.error || result.data !== true)
      return { message: 'Not saved. Refresh the queue and check your operator access.' };
    revalidatePath('/operations');
    return {
      message:
        input.status === 'erase'
          ? 'Contact details erased.'
          : 'Status saved. This action does not send email.',
    };
  } catch {
    return { message: 'Invalid request. Refresh and try again.' };
  }
}
