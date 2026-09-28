import { freshnessRadar } from './california-passport';
import { companyReview } from './company-review';
import { informationRequestQueue } from './information-requests';
import { profileCompletion } from './profile-completion';
import type { TenantData } from './tenant-types';

export type CompanyNextAction = {
  id: string;
  label: string;
  title: string;
  detail: string;
  href: string;
};

// A read-only summary of the already-authorized snapshot, never an eligibility assessment.
export function companyNextActions(data: TenantData) {
  const progress = profileCompletion(data.facts, data.reviewAsOf);
  const radar = freshnessRadar(data.facts, data.reviewAsOf);
  const requests = informationRequestQueue(data).filter((item) => item.status !== 'complete');
  const review = companyReview(data.facts, data.reviewAsOf).queue;
  const admin = data.organization.role === 'organization_admin';
  const actions: CompanyNextAction[] = [];
  const add = (action: CompanyNextAction) => {
    if (!actions.some((item) => item.id === action.id)) actions.push(action);
  };
  const expired = radar
    .filter((item) => item.window === 'expired')
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0) || a.fact.id.localeCompare(b.fact.id))[0];
  if (expired)
    add({
      id: `fact-${expired.fact.id}`,
      label: 'Expired evidence',
      title: expired.fact.label,
      detail: `Recorded expiration: ${expired.fact.expiration_date}. ${admin ? 'Check the renewal and update the source record.' : 'Ask the record owner or administrator for current evidence.'}`,
      href: `#fact-${expired.fact.id}`,
    });
  const overdue = requests.find((item) => item.overdue);
  if (overdue)
    add({
      id: `request-${overdue.id}`,
      label: 'Overdue request',
      title: overdue.label,
      detail: `Due ${overdue.due_on}. Open the request to check its owner and the information still needed.`,
      href: `#information-request-${overdue.id}`,
    });
  const stale = radar
    .filter((item) => item.stale && item.window !== 'expired')
    .sort(
      (a, b) =>
        (a.checked ?? '').localeCompare(b.checked ?? '') || a.fact.id.localeCompare(b.fact.id),
    )[0];
  if (stale)
    add({
      id: `fact-${stale.fact.id}`,
      label: 'Source needs rechecking',
      title: stale.fact.label,
      detail: `Last checked ${stale.checked}, more than 90 days ago. Confirm the source before relying on this record.`,
      href: `#fact-${stale.fact.id}`,
    });
  const expiring = radar
    .filter((item) => item.window === '30')
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0) || a.fact.id.localeCompare(b.fact.id))[0];
  if (expiring)
    add({
      id: `fact-${expiring.fact.id}`,
      label: 'Renewal approaching',
      title: expiring.fact.label,
      detail: `Recorded expiration: ${expiring.fact.expiration_date}. Check the renewal against the dates of any bid using this evidence.`,
      href: `#fact-${expiring.fact.id}`,
    });
  const pending = review.find(
    (item) => !actions.some((action) => action.id === `fact-${item.fact.id}`),
  );
  if (pending)
    add({
      id: `fact-${pending.fact.id}`,
      label: 'Human review needed',
      title: pending.fact.label,
      detail: admin
        ? 'Check the source and details before recording an attestation.'
        : 'View the source and ask an administrator to review or correct this record.',
      href: `#fact-${pending.fact.id}`,
    });
  const request = requests.find(
    (item) => !actions.some((action) => action.id === `request-${item.id}`),
  );
  if (request)
    add({
      id: `request-${request.id}`,
      label:
        request.status === 'pending_review' ? 'Request ready for review' : 'Information request',
      title: request.label,
      detail:
        'Open the existing request to check ownership and progress before creating more follow-up work.',
      href: `#information-request-${request.id}`,
    });
  if (progress.next)
    add({
      id: `setup-${progress.next.section}`,
      label: 'Profile fields missing',
      title: progress.next.label,
      detail: `${progress.next.total - progress.next.completed} checklist fields are not recorded in this view. ${admin ? 'Save what you can support; leave unknowns blank.' : 'Review the questions with your administrator.'}`,
      href: progress.next.factId
        ? `#fact-${progress.next.factId}`
        : `#passport-${progress.next.section}`,
    });
  return {
    actions: actions.slice(0, 3),
    progress,
    renewalCount: radar.filter((item) => item.window || item.stale).length,
    requests,
  };
}
