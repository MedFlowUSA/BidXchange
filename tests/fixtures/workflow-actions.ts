import { releaseActionInput } from '../../apps/web/lib/response-release';
import { outcomeNote } from '../../apps/web/lib/outcome-note';
export async function saveReleaseAction(_state: unknown, form: FormData) {
  const d = JSON.parse(String(form.get('payload')));
  if (d.action === 'followup') {
    const parsed = releaseActionInput.safeParse(d);
    if (!parsed.success || parsed.data.action !== 'followup')
      return { message: 'Invalid synthetic follow-up', success: false };
    return { message: outcomeNote(parsed.data.note, parsed.data.outcome), success: true };
  }
  return {
    message: d.confirmed
      ? 'Synthetic submission captured; no buyer action.'
      : 'Synthetic action captured.',
    success: true,
  };
}
