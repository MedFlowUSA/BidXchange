'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { CaptureForm } from './capture-forms';
import { saveInformationRequest } from '../app/information-request-actions';
import { informationRequestQueue, requestStatusLabels } from '../lib/information-requests';
import { workspaceHref } from '../lib/routes';
type Request = TenantData['onboarding'][number];

export function InformationRequestForm({
  data,
  request,
  section = '',
  item = '',
  missing = [],
}: {
  data: TenantData;
  request?: Request;
  section?: string;
  item?: string;
  missing?: string[];
}) {
  const admin = data.organization.role === 'organization_admin';
  if (
    !admin &&
    (!request ||
      request.assigned_user_id !== data.userId ||
      request.status === 'complete' ||
      data.organization.role === 'viewer')
  )
    return null;
  if (request && !request.updated_at) return null;
  const fixed = {
    label: request?.label ?? (item ? `Complete: ${item}` : ''),
    assigned_user_id: request?.assigned_user_id ?? '',
    due_on: request?.due_on ?? '',
  };
  return (
    <CaptureForm
      label={
        request
          ? admin
            ? 'Manage information request'
            : 'Update my request'
          : item
            ? 'Assign information request'
            : 'Create information request'
      }
      action={saveInformationRequest}
      hidden={{
        organization_id: data.organization.id,
        record_id: request?.id ?? '',
        updated_at: request?.updated_at ?? '',
        passport_section: request?.passport_section ?? section,
        passport_item: request?.passport_item ?? item,
        ...(!admin ? fixed : {}),
      }}
      initial={{
        ...fixed,
        status: request?.status ?? 'needs_information',
        notes:
          request?.notes ??
          (missing.length
            ? `Please add: ${missing.join('; ')}. Save evidence in Company, then mark this request ready for review.`
            : ''),
      }}
      fields={[
        ...(admin
          ? [
              { name: 'label', label: 'Information requested', required: true, max: 200 },
              {
                name: 'assigned_user_id',
                label: 'Request owner',
                required: !request,
                options: [
                  { value: '', label: 'Unassigned' },
                  ...(data.informationRequestOwners ?? []).map((m) => ({
                    value: m.user_id,
                    label: `${m.user_id === data.userId ? 'You — ' : ''}${m.email} (${m.role.replaceAll('_', ' ')})`,
                  })),
                ],
              },
              {
                name: 'due_on',
                label: 'Requested by date',
                inputType: 'date' as const,
                required: !request,
              },
            ]
          : []),
        {
          name: 'status',
          label: 'Request status',
          options: Object.entries(requestStatusLabels)
            .filter(([key]) =>
              request ? admin || key !== 'complete' : key === 'needs_information',
            )
            .map(([value, label]) => ({ value, label })),
        },
        { name: 'notes', label: 'Progress or closure note', multiline: true, max: 4000 },
      ]}
      note="Requests and notes are visible to company members. Keep private evidence in its authorized Company record. Saving creates an in-app request only; no email is sent. Closing a request does not attest evidence or fill profile fields."
    />
  );
}

export function ProfileInformationRequest({
  data,
  section,
  item,
  missing,
}: {
  data: TenantData;
  section: string;
  item: string;
  missing: string[];
}) {
  const existing = data.onboarding.find(
    (r) => r.passport_section === section && r.passport_item === item,
  );
  if (existing)
    return (
      <p>
        <Link href={`#information-request-${existing.id}`}>
          Open information request ·{' '}
          {requestStatusLabels[existing.status as keyof typeof requestStatusLabels]}
        </Link>
      </p>
    );
  if (data.organization.role !== 'organization_admin') return null;
  return <InformationRequestForm data={data} section={section} item={item} missing={missing} />;
}

export default function InformationRequests({
  data,
  compact = false,
}: {
  data: TenantData;
  compact?: boolean;
}) {
  const admin = data.organization.role === 'organization_admin';
  const [filter, setFilter] = useState(admin ? 'open' : 'mine');
  const [target, setTarget] = useState('');
  useEffect(() => {
    const reveal = () => {
      if (location.hash.startsWith('#information-request-')) {
        setTarget(location.hash.slice('#information-request-'.length));
        setFilter('all');
      }
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, []);
  const rows = informationRequestQueue(data);
  const filtered = rows.filter(
    (r) =>
      filter === 'all' ||
      (filter === 'mine'
        ? r.assigned_user_id === data.userId && r.status !== 'complete'
        : filter === 'review'
          ? r.status === 'pending_review'
          : filter === 'closed'
            ? r.status === 'complete'
            : r.status !== 'complete'),
  );
  const shown = compact ? filtered.slice(0, 5) : filtered;
  const ownerName = (id?: string | null) =>
    !id
      ? 'Unassigned'
      : id === data.userId
        ? 'You'
        : (data.informationRequestOwners?.find((m) => m.user_id === id)?.email ??
          `Company member ${id.slice(0, 8)}`);
  return (
    <section className="panel" id="company-onboarding" aria-labelledby="information-requests-title">
      <h2 id="information-requests-title">Company information requests</h2>
      <p>
        {rows.filter((r) => r.status !== 'complete').length} open ·{' '}
        {rows.filter((r) => r.overdue).length} overdue ·{' '}
        {rows.filter((r) => r.status === 'pending_review').length} ready for review. Dates use{' '}
        {data.organization.default_timezone}.
      </p>
      <label>
        Show requests{' '}
        <select
          aria-label="Show requests"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="mine">Assigned to me</option>
          <option value="open">All open requests</option>
          <option value="review">Ready for review</option>
          <option value="closed">Closed</option>
          <option value="all">All requests</option>
        </select>
      </label>
      {!shown.length && (
        <p>
          No requests match this view. Administrators can assign missing Passport information or
          create a request from the Company page.
        </p>
      )}
      {shown.map((r) => (
        <details
          key={`${r.id}:${r.updated_at}`}
          id={`information-request-${r.id}`}
          open={r.id === target}
        >
          <summary>
            {r.overdue ? 'Overdue · ' : ''}
            {r.label} ·{' '}
            {requestStatusLabels[r.status as keyof typeof requestStatusLabels] ?? r.status}
          </summary>
          <p>
            Owner: {ownerName(r.assigned_user_id)} · Due: {r.due_on ?? 'Not assigned'}
          </p>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {r.notes || 'No progress note recorded.'}
          </p>
          {r.completed_at && (
            <p>
              Closed by {ownerName(r.completed_by)} on {r.completed_at}. Evidence review remains
              separate.
            </p>
          )}
          {r.passport_section && (
            <p>
              <Link
                href={
                  workspaceHref('/company', data.organization.id) +
                  `#passport-${r.passport_section}`
                }
              >
                Open related Passport section
              </Link>
            </p>
          )}
          <InformationRequestForm data={data} request={r} />
        </details>
      ))}
      {compact ? (
        <p>
          <Link href={workspaceHref('/company', data.organization.id) + '#company-onboarding'}>
            Manage all company information requests
          </Link>
        </p>
      ) : (
        <InformationRequestForm data={data} />
      )}
      {data.onboarding.length >= 500 && (
        <p>Showing up to 500 visible checklist items; additional records may exist.</p>
      )}
    </section>
  );
}
