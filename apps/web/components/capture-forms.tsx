'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  saveOpportunity,
  savePursuitTask,
  startPursuit,
  saveRequirement,
} from '../app/capture-actions';
import { requirementStatuses } from '../lib/capture-input';
import type { MutationState } from '../app/actions';
import type { LiveOpportunity, TenantData } from '../lib/tenant-types';
import ZonedDateField from './zoned-date-field';

type Field = {
  name: string;
  label: string;
  required?: boolean;
  max?: number;
  multiline?: boolean;
  inputType?: 'date';
  dateTimeZone?: { field: string } | { fixed: string };
  options?: { value: string; label: string }[];
};
export function CaptureForm({
  label,
  action,
  hidden,
  initial,
  fields,
  note,
  confirmSource = false,
  confirmTask = false,
}: {
  label: string;
  action: (state: MutationState, form: FormData) => Promise<MutationState>;
  hidden: Record<string, string>;
  initial: Record<string, string>;
  fields: Field[];
  note: string;
  confirmSource?: boolean;
  confirmTask?: boolean;
}) {
  const [state, submit, pending] = useActionState(action, { message: '' } as MutationState);
  const [draft, setDraft] = useState(initial);
  // A refreshed parent must not pair an old draft with a newer write version.
  const [draftIdentity] = useState(hidden);
  return (
    <details className="company-record-editor" aria-label={label}>
      <summary className={label === 'Add opportunity' ? 'button primary' : 'text-button'}>
        {label}
      </summary>
      {
        <form
          action={submit}
          className="opportunity-form admin-form"
          aria-label={label}
          // React requests a native reset after an action returns, including a handled error.
          // Keep controlled drafts (especially select elements) intact for retry/review.
          onReset={(event) => event.preventDefault()}
        >
          {Object.entries(draftIdentity).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <p>{note}</p>
          <fieldset disabled={pending || state.success}>
            <legend>{label}</legend>
            {fields.map((field) => {
              if (field.dateTimeZone)
                return (
                  <ZonedDateField
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    initialValue={initial[field.name] ?? ''}
                    required={field.required}
                    timeZone={
                      'field' in field.dateTimeZone
                        ? (draft[field.dateTimeZone.field] ?? '')
                        : field.dateTimeZone.fixed
                    }
                  />
                );
              const props = {
                name: field.name,
                'aria-label': field.label,
                required: field.required,
                value: draft[field.name] ?? '',
                onChange: (
                  event: React.ChangeEvent<
                    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                  >,
                ) => setDraft((current) => ({ ...current, [field.name]: event.target.value })),
              };
              return (
                <label key={field.name}>
                  {field.label}
                  {field.options ? (
                    <select {...props}>
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.multiline ? (
                    <textarea {...props} maxLength={field.max} rows={4} />
                  ) : (
                    <input {...props} type={field.inputType ?? 'text'} maxLength={field.max} />
                  )}
                </label>
              );
            })}
            {confirmSource && (
              <label>
                <input type="checkbox" required /> I checked the quoted wording, its conditions and
                citation against the original notice.
              </label>
            )}
            {confirmTask && (
              <label>
                <input type="checkbox" name="review_confirmed" required /> I reviewed this
                AI-proposed task, checked existing work, and chose its owner and date or left them
                explicitly unassigned.
              </label>
            )}
            <button className="button primary" type="submit">
              {pending ? 'Saving…' : label}
            </button>
          </fieldset>
          {state.message && <p role="status">{state.message}</p>}
          {state.href && (
            <Link href={state.href} className="button secondary">
              Open workspace record
            </Link>
          )}
          {state.success && !state.href && (
            <button
              type="button"
              className="button secondary"
              onClick={() => window.location.reload()}
            >
              Continue with saved records
            </button>
          )}
        </form>
      }
    </details>
  );
}
const deadlineNote =
  'Choose the date and local time shown in the notice, then check the time zone and saved-time preview. Changing the time zone keeps the entered clock time. Leave unknown dates blank.';
export function RequirementForm({
  data,
  pursuitId,
  requirement,
  sourceDraft,
}: {
  data: TenantData;
  pursuitId: string;
  requirement?: NonNullable<TenantData['requirements']>[number];
  sourceDraft?: { requirement: string; citation: string };
}) {
  return (
    <CaptureForm
      label={
        requirement
          ? 'Edit requirement'
          : sourceDraft
            ? 'Review and add requirement'
            : 'Add requirement'
      }
      confirmSource={Boolean(sourceDraft)}
      action={saveRequirement}
      hidden={{
        organization_id: data.organization.id,
        pursuit_id: pursuitId,
        record_id: requirement?.id ?? '',
        updated_at: requirement?.updated_at ?? '',
      }}
      initial={{
        requirement: requirement?.requirement ?? sourceDraft?.requirement ?? '',
        citation: requirement?.citation ?? sourceDraft?.citation ?? '',
        owner_user_id: requirement?.owner_user_id ?? '',
        status:
          requirement?.status && Object.hasOwn(requirementStatuses, requirement.status)
            ? requirement.status
            : 'needs_review',
      }}
      note="Record one requirement and its exact notice section or buyer clarification. All workspace members can read this register; keep restricted company evidence in Company. These follow-up states do not certify compliance."
      fields={[
        {
          name: 'requirement',
          label: 'Requirement text',
          required: true,
          max: 4000,
          multiline: true,
        },
        { name: 'citation', label: 'Notice citation', required: true, max: 2000, multiline: true },
        {
          name: 'status',
          label: 'Follow-up status',
          options: Object.entries(requirementStatuses).map(([value, label]) => ({ value, label })),
        },
        {
          name: 'owner_user_id',
          label: 'Requirement owner',
          options: [
            { value: '', label: 'Unassigned' },
            ...data.members
              .filter((member) => member.status === 'active')
              .map((member) => ({
                value: member.user_id,
                label:
                  member.user_id === data.userId
                    ? 'You'
                    : `${member.role.replaceAll('_', ' ')}: ${member.user_id}`,
              })),
          ],
        },
      ]}
    />
  );
}
export function OpportunityForm({
  data,
  opportunity,
  defaults,
}: {
  data: { organization: Pick<TenantData['organization'], 'id' | 'default_timezone'> };
  opportunity?: LiveOpportunity;
  defaults?: Partial<LiveOpportunity>;
}) {
  const initial = opportunity ?? defaults;
  return (
    <CaptureForm
      label={opportunity ? 'Edit opportunity' : 'Add opportunity'}
      action={saveOpportunity}
      hidden={{
        organization_id: data.organization.id,
        record_id: opportunity?.id ?? '',
        updated_at: opportunity?.updated_at ?? '',
      }}
      initial={{
        title: initial?.title ?? '',
        buyer: initial?.buyer ?? '',
        solicitation_number: initial?.solicitation_number ?? '',
        source_url: initial?.source_url ?? '',
        source_note: initial?.source_note ?? '',
        summary: initial?.summary ?? '',
        official_deadline: initial?.official_deadline ?? '',
        deadline_timezone: initial?.deadline_timezone ?? data.organization.default_timezone,
      }}
      note={`Record the original notice or a traceable source note. ${deadlineNote}`}
      fields={[
        { name: 'title', label: 'Opportunity title', required: true, max: 200 },
        { name: 'buyer', label: 'Buyer', max: 200 },
        { name: 'solicitation_number', label: 'Solicitation number', max: 200 },
        { name: 'source_url', label: 'Source URL', max: 2000 },
        { name: 'source_note', label: 'Source note', max: 2000, multiline: true },
        { name: 'summary', label: 'Scope summary', max: 6000, multiline: true },
        { name: 'deadline_timezone', label: 'Deadline time zone', required: true, max: 100 },
        {
          name: 'official_deadline',
          label: 'Official deadline',
          dateTimeZone: { field: 'deadline_timezone' },
        },
      ]}
    />
  );
}
export function StartPursuitForm({
  organizationId,
  opportunityId,
}: {
  organizationId: string;
  opportunityId: string;
}) {
  return (
    <CaptureForm
      label="Create planning workspace"
      action={startPursuit}
      hidden={{ organization_id: organizationId, opportunity_id: opportunityId }}
      initial={{}}
      fields={[]}
      note="Organize tasks while the human bid decision is pending. Qualification, pricing approval and submission are separate steps."
    />
  );
}
export function TaskForm({
  data,
  pursuitId,
  task,
  suggestedTitle,
  suggestedRequirementId,
  suggestedNotes,
  review,
  action = savePursuitTask,
}: {
  data: TenantData;
  pursuitId: string;
  task?: TenantData['tasks'][number];
  suggestedTitle?: string;
  suggestedRequirementId?: string;
  suggestedNotes?: string;
  review?: { token: string; creationId: string };
  action?: (state: MutationState, form: FormData) => Promise<MutationState>;
}) {
  return (
    <CaptureForm
      label={review ? 'Review and save task' : task ? 'Edit task' : 'Add task'}
      action={action}
      confirmTask={!!review}
      hidden={{
        organization_id: data.organization.id,
        pursuit_id: pursuitId,
        record_id: task?.id ?? '',
        updated_at: task?.updated_at ?? '',
        ...(review
          ? { action_token: review.token, creation_id: review.creationId, status: 'todo' }
          : {}),
      }}
      initial={{
        title: task?.title ?? suggestedTitle ?? '',
        status: task?.status ?? 'todo',
        assigned_user_id: task?.assigned_user_id ?? '',
        due_at: task?.due_at ?? '',
        due_timezone: task?.due_timezone ?? data.organization.default_timezone,
        requirement_id: task?.requirement_id ?? suggestedRequirementId ?? '',
        priority: task?.priority ?? 'normal',
        notes: task?.notes ?? suggestedNotes ?? '',
      }}
      note={`Assign a member and track the next action. ${deadlineNote}`}
      fields={[
        { name: 'title', label: 'Task title', required: true, max: 200 },
        {
          name: 'status',
          label: 'Task status',
          options: ['todo', 'in_progress', 'complete'].map((value) => ({
            value,
            label: value.replaceAll('_', ' '),
          })),
        },
        {
          name: 'assigned_user_id',
          label: 'Task owner',
          options: [
            { value: '', label: 'Unassigned' },
            ...data.members
              .filter((member) => member.status === 'active')
              .map((member) => ({
                value: member.user_id,
                label:
                  member.user_id === data.userId
                    ? `You (${member.role.replaceAll('_', ' ')})`
                    : `${member.role.replaceAll('_', ' ')} · ${member.user_id}`,
              })),
          ],
        },
        { name: 'due_timezone', label: 'Task time zone', required: true, max: 100 },
        { name: 'due_at', label: 'Task deadline', dateTimeZone: { field: 'due_timezone' } },
        ...(data.contractorWorkflowEnabled
          ? [
              {
                name: 'requirement_id',
                label: 'Linked requirement',
                options: [
                  { value: '', label: 'No linked requirement' },
                  ...(data.requirements ?? [])
                    .filter((r) => r.pursuit_id === pursuitId)
                    .map((r) => ({ value: r.id, label: r.requirement })),
                ],
              },
              {
                name: 'priority',
                label: 'Task priority',
                options: ['low', 'normal', 'high', 'urgent'].map((value) => ({
                  value,
                  label: value,
                })),
              },
              {
                name: 'notes',
                label: 'Task notes and source reference',
                max: 4000,
                multiline: true,
              },
            ]
          : []),
      ].filter((field) => !review || field.name !== 'status')}
    />
  );
}
