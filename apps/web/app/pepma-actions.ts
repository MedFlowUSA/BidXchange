'use server';
import { pepmaInput, pepmaOpportunity } from '../lib/pepma';
import { saveOpportunity } from './capture-actions';
import type { MutationState } from './actions';

export async function savePepmaOpportunity(
  _: MutationState,
  form: FormData,
): Promise<MutationState> {
  const parsed = pepmaInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { message: parsed.error.issues[0]?.message ?? 'Check the PEPMA fields.' };
  try {
    const values = pepmaOpportunity(parsed.data);
    const capture = new FormData();
    for (const [key, value] of Object.entries(values)) capture.set(key, value);
    // The same authenticated capture permission, rate limit, RLS and history as normal intake.
    return await saveOpportunity(_, capture);
  } catch {
    return { message: 'The PEPMA details could not be saved. Review their lengths and dates.' };
  }
}
