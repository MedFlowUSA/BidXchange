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

type Field = {
  name: string;
  label: string;
  required?: boolean;
  max?: number;
  multiline?: boolean;
  options?: { value: string; label: string }[];
};
function CaptureForm({
  label,
  action,
  hidden,
  initial,
  fields,
  note,
}: {
  label: string;
  action: (state: MutationState, form: FormData) => Promise<MutationState>;
  hidden: Record<string, string>;
  initial: Record<string, string>;
  fields: Field[];
  note: string;
}) {
  const [state, submit, pending] = useActionState(action, { message: '' } as MutationState);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(initial);
  // A refreshed parent must not pair an old draft with a newer write version.
  const [draftIdentity] = useState(hidden);
  return (
    <details
      className="company-record-editor"
      aria-label={label}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{label}</summary>
      {expanded && (
        <form action={submit} className="opportunity-form admin-form" aria-label={label}>
          {Object.entries(draftIdentity).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <p>{note}</p>
          <fieldset disabled={pending || state.success}>
            <legend>{label}</legend>
            {fields.map((field) => {
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
                    <input {...props} maxLength={field.max} />
                  )}
                </label>
              );
            })}
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
      )}
    </details>
  );
}
const deadlineNote =
  'Enter timestamps with an explicit UTC offset, for example 2026-10-15T14:00:00-07:00. The offset fixes the instant; the time zone controls display. Leave unknown dates blank.';
export function RequirementForm({
  data,
  pursuitId,
  requirement,
}: {
  data: TenantData;
  pursuitId: string;
  requirement?: NonNullable<TenantData['requirements']>[number];
}) {
  return (
    <CaptureForm
      label={requirement ? 'Edit requirement' : 'Add requirement'}
      action={saveRequirement}
      hidden={{
        organization_id: data.organization.id,
        pursuit_id: pursuitId,
        record_id: requirement?.id ?? '',
        updated_at: requirement?.updated_at ?? '',
      }}
      initial={{
        requirement: requirement?.requirement ?? '',
        citation: requirement?.citation ?? '',
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
}: {
  data: TenantData;
  opportunity?: LiveOpportunity;
}) {
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
        title: opportunity?.title ?? '',
        buyer: opportunity?.buyer ?? '',
        solicitation_number: opportunity?.solicitation_number ?? '',
        source_url: opportunity?.source_url ?? '',
        source_note: opportunity?.source_note ?? '',
        summary: opportunity?.summary ?? '',
        official_deadline: opportunity?.official_deadline ?? '',
        deadline_timezone: opportunity?.deadline_timezone ?? data.organization.default_timezone,
      }}
      note={`Record the original notice or a traceable source note. ${deadlineNote}`}
      fields={[
        { name: 'title', label: 'Opportunity title', required: true, max: 200 },
        { name: 'buyer', label: 'Buyer', max: 200 },
        { name: 'solicitation_number', label: 'Solicitation number', max: 200 },
        { name: 'source_url', label: 'Source URL', max: 2000 },
        { name: 'source_note', label: 'Source note', max: 2000, multiline: true },
        { name: 'summary', label: 'Scope summary', max: 6000, multiline: true },
        { name: 'official_deadline', label: 'Official deadline with offset', max: 40 },
        { name: 'deadline_timezone', label: 'Deadline time zone', required: true, max: 100 },
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
}: {
  data: TenantData;
  pursuitId: string;
  task?: TenantData['tasks'][number];
}) {
  return (
    <CaptureForm
      label={task ? 'Edit task' : 'Add task'}
      action={savePursuitTask}
      hidden={{
        organization_id: data.organization.id,
        pursuit_id: pursuitId,
        record_id: task?.id ?? '',
        updated_at: task?.updated_at ?? '',
      }}
      initial={{
        title: task?.title ?? '',
        status: task?.status ?? 'todo',
        assigned_user_id: task?.assigned_user_id ?? '',
        due_at: task?.due_at ?? '',
        due_timezone: task?.due_timezone ?? data.organization.default_timezone,
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
        { name: 'due_at', label: 'Task deadline with offset', max: 40 },
        { name: 'due_timezone', label: 'Task time zone', required: true, max: 100 },
      ]}
    />
  );
}
