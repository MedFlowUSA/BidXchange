import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { hasCurrentRegisterSignoff } from '../lib/workspace-guide';
import { freshnessRadar } from '../lib/california-passport';
import { releaseHandoff } from '../lib/submission-handoff';

export function pursuitNextStep(data: TenantData, pursuitId: string) {
  const rows = (data.requirements ?? []).filter((r) => r.pursuit_id === pursuitId);
  const ids = new Set(rows.map((r) => r.id));
  const facts = new Set(
    (data.evidenceReviews ?? [])
      .filter((r) => ids.has(r.requirement_id) && r.applicability !== 'not_applicable')
      .map((r) => r.fact_id),
  );
  const stale = freshnessRadar(
    data.facts.filter((f) => facts.has(f.id)),
    data.reviewAsOf,
  ).find((r) => r.stale || r.window === 'expired');
  if (stale)
    return {
      title: `Update ${stale.fact.label}`,
      href: `/company?organization=${data.organization.id}#fact-${stale.fact.id}`,
      reason: 'Evidence cited in this bid is expired or was last checked over 90 days ago.',
    };
  const remaining = rows.filter(
    (r) =>
      !data.resolutions?.some(
        (h) => h.requirement_id === r.id && h.review_current && h.disposition !== 'needs_review',
      ),
  ).length;
  if (!hasCurrentRegisterSignoff(data))
    return {
      title: `Review remaining requirements (${remaining} left)`,
      href: '#pursuit-requirements',
      reason: remaining
        ? 'Record a human disposition for each requirement, then sign off the register.'
        : 'Review the source for omissions and sign off the current register.',
    };
  const decision = data.decisions?.[0];
  if (
    !decision ||
    decision.context_token !== data.decisionContext ||
    !['bid', 'no_bid'].includes(decision.decision)
  )
    return {
      title: 'Record bid or no-bid',
      href: '#bid-decision',
      reason: 'A named approver must decide using the signed register and current evidence.',
    };
  if (decision.decision === 'no_bid')
    return {
      title: 'Review recorded no-bid decision',
      href: '#bid-decision',
      reason: 'No-bid is recorded. Further response work requires a new human decision.',
    };
  const release = data.releaseWorkflow?.versions[0];
  if (
    !release ||
    !releaseHandoff(release.snapshot.checklist, release.checksum, release.status).ready ||
    data.amendments?.some((a) => !a.reviewed)
  )
    return {
      title: 'Open submission handoff',
      href: '#response-release',
      reason:
        'Review the packet, destination, named submitter and external completion confirmation.',
    };
  if (!data.responsePackages?.length)
    return {
      title: 'Create response outline',
      href: '#response-packages',
      reason: 'Build from reviewed evidence and leave missing content for a person.',
    };
  return {
    title: 'Record submission',
    href: '#response-release',
    reason: 'After a person submits externally, record the confirmation and receipt limitation.',
  };
}
export default function PursuitNextStep({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const action = pursuitNextStep(data, pursuitId);
  return (
    <section className="bid-next" aria-label="Next step">
      <div>
        <div className="eyebrow">NEXT STEP</div>
        <p>{action.reason}</p>
      </div>
      <Link className="button primary" href={action.href}>
        {action.title}
      </Link>
    </section>
  );
}
