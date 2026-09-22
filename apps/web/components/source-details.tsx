import Link from 'next/link';
import { detailFields, readNormalized, externalUrl } from '../lib/sources/normalized';
import { findSource } from '../lib/sources/registry';
import type { TenantData, LiveOpportunity } from '../lib/tenant-types';
import { SourceOpportunityForm } from './source-registry';
import { reviewStatus } from '../lib/company-readiness';
import { workspaceHref } from '../lib/routes';

export default function SourceDetails({
  data,
  opportunity,
  handoff = false,
}: {
  data: TenantData;
  opportunity: LiveOpportunity;
  handoff?: boolean;
}) {
  const details = readNormalized(opportunity.source_details);
  if (!details) return null;
  const source = findSource(details.sourceId)!;
  const canEdit = ['organization_admin', 'capture_manager'].includes(data.organization.role);
  const pursuit = data.pursuits.find((p) => p.opportunity_id === opportunity.id);
  const checks: [string, string, string[]][] = [
    ['Capability', opportunity.summary ?? '', ['capability']],
    ['Geography', details.place, ['service_territory']],
    ['License', details.licenses, ['license']],
    ['Certification', details.certifications, ['certification']],
    ['Past performance', details.experience, ['past_performance']],
    ['Financial and bonding', details.bonding, ['bonding', 'financial']],
    ['Insurance', details.insurance, ['insurance']],
    ['Prequalification', details.prequalification, ['registration']],
    ['Capacity and scheduling', '', ['capacity', 'personnel']],
  ];
  const available = checks.map(([label, requirement, types]) => ({
    label,
    requirement,
    count: data.facts.filter(
      (f) =>
        types.includes(f.fact_type) &&
        ['reviewed', 'expiring'].includes(reviewStatus(f, data.reviewAsOf)),
    ).length,
  }));
  return (
    <section
      className="panel"
      aria-label="Source details and handoff"
      style={{ overflowWrap: 'anywhere' }}
    >
      <h2>
        {handoff ? 'Submission handoff' : 'Source details'} · {source.name}
      </h2>
      <p>
        Manual source record. No synchronization has occurred. Data confidence is not assessed;
        blank fields are unknown, not “not required.”
      </p>
      <dl>
        {Object.entries(detailFields).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>
              {details[key as keyof typeof detailFields] || 'Not recorded'}
            </dd>
          </div>
        ))}
      </dl>
      <dl>
        {[
          ['Published', details.publishedAt],
          ['Questions due', details.questionDeadline],
          ['Site visit', details.siteVisit],
          ['Pre-bid meeting', details.preBidMeeting],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || 'Not recorded'}</dd>
          </div>
        ))}
      </dl>
      <h3>Company evidence to review</h3>
      <p>
        Availability check against records visible to your role. These counts are not qualification
        matches or win probabilities.
      </p>
      <ul>
        {available.map((item) => (
          <li key={item.label}>
            {item.label}: {item.requirement ? 'Requirement recorded' : 'Requirements need review'};{' '}
            {item.count} current human-attested company records available for human comparison.
          </li>
        ))}
      </ul>
      <p>
        Strategic value, competition and win probability: not calculated. Buyer evaluation criteria,
        current capacity, competitive information and a validated estimation method are needed.
        Bid/no-bid authority remains with the designated reviewer.
      </p>
      <Link href={workspaceHref('/company', data.organization.id)}>Complete company evidence</Link>
      <h3>Buyer-designated submission destination</h3>
      {details.submissionUrl && externalUrl.safeParse(details.submissionUrl).success ? (
        <a href={details.submissionUrl} target="_blank" rel="noopener noreferrer">
          Open recorded submission destination: {new URL(details.submissionUrl).hostname}
        </a>
      ) : (
        <p>No destination recorded. Confirm it from the buyer’s notice before submission.</p>
      )}
      <p>
        Recorded deadline: {opportunity.official_deadline ?? 'Unknown'} ·{' '}
        {opportunity.deadline_timezone}. Verify this instant and time zone against the latest
        amendment.
      </p>
      <p>
        Before delivery, review amendments, signatures, pricing files, bonds, insurance, portal
        access and the complete file package with an authorized human. Opening a link does not
        submit anything.
      </p>
      {pursuit ? (
        <Link
          href={
            workspaceHref(`/pursuits/${pursuit.id}`, data.organization.id) + '#response-release'
          }
        >
          Open versioned checklist, approvals and submission confirmation
        </Link>
      ) : (
        <p>
          Start a pursuit from this opportunity to prepare documents, assign reviews and record a
          submission receipt.
        </p>
      )}
      {!handoff && (
        <p>
          <Link
            href={workspaceHref(`/opportunities/${opportunity.id}/handoff`, data.organization.id)}
          >
            Open submission handoff page
          </Link>
        </p>
      )}
      {canEdit && !handoff && (
        <SourceOpportunityForm
          key={opportunity.updated_at}
          org={data.organization.id}
          source={source}
          opportunity={opportunity}
        />
      )}
    </section>
  );
}
