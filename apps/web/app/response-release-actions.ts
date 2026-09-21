'use server';
import { revalidatePath } from 'next/cache';
import { accountContext } from '../lib/tenant';
import { releaseActionInput } from '../lib/response-release';
export async function saveReleaseAction(
  _state: { message: string; success?: boolean },
  form: FormData,
) {
  if (process.env.BIDXCHANGE_RELEASES_ENABLED !== 'true')
    return { message: 'Approval and submission recording is not activated in this environment.' };
  try {
    const raw = form.get('payload');
    if (typeof raw !== 'string' || raw.length > 60000) return { message: 'Check the form length.' };
    const input = releaseActionInput.safeParse(JSON.parse(raw));
    if (!input.success)
      return {
        message:
          'Check required fields, timestamps with timezone offsets, references and confirmation.',
      };
    const d = input.data,
      account = await accountContext();
    const role = account.choices.find((c) => c.id === d.organization)?.role;
    if (!account.user || !account.supabase || !role)
      return { message: 'Workspace access required.' };
    const allowed =
      d.action === 'freeze'
        ? ['organization_admin', 'capture_manager']
        : d.action === 'approve'
          ? [
              'organization_admin',
              'executive_approver',
              ...(d.gate === 'pricing' ? ['estimator'] : []),
            ]
          : ['organization_admin', 'executive_approver', 'capture_manager'];
    if (!allowed.includes(role))
      return { message: 'Your current role cannot perform this action.' };
    const db = account.supabase;
    const result =
      d.action === 'freeze'
        ? await db.rpc('freeze_response_release', {
            org: d.organization,
            pursuit: d.pursuit,
            package: d.package,
            expected_version: d.version,
            expected_context: d.context,
            checklist: d.checklist,
          })
        : d.action === 'approve'
          ? await db.rpc('record_response_approval', {
              org: d.organization,
              release: d.release,
              expected_checksum: d.checksum,
              gate: d.gate,
              outcome: d.decision,
              rationale: d.rationale,
              conditions: d.conditions,
              expected_previous: d.previous,
            })
          : d.action === 'submit'
            ? await db.rpc('record_response_submission', {
                org: d.organization,
                release: d.release,
                expected_checksum: d.checksum,
                details: d.details,
                previous: d.previous,
                confirmed: d.confirmed,
              })
            : await db.rpc('record_response_followup', {
                org: d.organization,
                release: d.release,
                event_type: d.event,
                note: d.note,
                due_at: d.due || null,
              });
    if (result.error)
      return {
        message:
          'Not recorded. Resolve readiness blockers, check your role and reload changed records. Your entered text remains in this form.',
      };
    revalidatePath('/', 'layout');
    return {
      message: 'Recorded with your identity and time. Reload to review the current history.',
      success: true,
    };
  } catch {
    return { message: 'Could not record this action. Check the fields and try again.' };
  }
}
