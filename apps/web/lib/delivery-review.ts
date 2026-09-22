import type { TenantData } from './tenant-types';
import { reviewStatus } from './company-readiness';

export const deliveryChecks = [
  {
    id: 'staffing',
    title: 'Crew and schedule',
    kind: 'staffing_capacity',
    task: 'Delivery review: confirm crew availability and overlapping commitments',
    question:
      'Compare the performance period with available staff, committed backlog and other active bids. Record the dates and assumptions in Company Passport.',
  },
  {
    id: 'equipment',
    title: 'Equipment availability',
    kind: 'equipment',
    task: 'Delivery review: confirm equipment availability and lead times',
    question:
      'Confirm quantities, location, lease conditions and availability for the required delivery period.',
  },
  {
    id: 'partners',
    title: 'Partner commitments',
    kind: 'partner_qualification',
    task: 'Delivery review: confirm partner scope and commitments',
    question:
      'Confirm the proposed scope, qualifications, permission to use evidence and the partner’s actual commitment. A listed partner is not a confirmed resource.',
  },
  {
    id: 'finance',
    title: 'Cost and cash requirements',
    kind: 'financial_capacity',
    task: 'Delivery review: validate cost assumptions and cash requirements',
    question:
      'Review labor, equipment, subcontractor costs, payment timing and contingency with the estimator. Company financial capacity is not a project margin estimate.',
  },
  {
    id: 'suppliers',
    title: 'Supplier quotes',
    kind: '',
    task: 'Delivery review: verify supplier quote scope, expiry and exclusions',
    question:
      'Check quote validity, delivery dates, exclusions and pricing assumptions against this bid. Reference the controlled quote in the task title; this panel does not ingest supplier quotes.',
  },
] as const;

export function deliveryReview(data: TenantData, pursuitId: string) {
  if (!data.pursuits.some((p) => p.id === pursuitId)) return [];
  return deliveryChecks.map((check) => ({
    ...check,
    records: data.facts
      .filter((fact) => !!check.kind && fact.structured_kind === check.kind)
      .map((fact) => ({ fact, status: reviewStatus(fact, data.reviewAsOf) })),
  }));
}
