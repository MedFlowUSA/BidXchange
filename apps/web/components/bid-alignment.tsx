'use client';
import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { bidAlignment } from '../lib/bid-alignment';
import styles from './bid-alignment.module.css';

export default function BidAlignment({
  data,
  pursuitId,
  restricted = false,
}: {
  data: TenantData;
  pursuitId: string;
  restricted?: boolean;
}) {
  const result = bidAlignment(data, pursuitId, restricted, new Date(data.reviewAsOf));
  return (
    <div className={styles.alignment} aria-label="Job requirements and company resources">
      <div className={styles.summary}>
        <strong>{result.percent === null ? 'Not calculated' : `${result.percent}%`}</strong>
        <div>
          <h3>Reviewed resource alignment</h3>
          <p>
            {result.percent === null
              ? result.reason
              : `${result.supported} of ${result.applicable} applicable requirements supported by reviewed company resources.`}
          </p>
          <p>
            {result.excluded} current waivers / not-applicable findings excluded. {result.potential}{' '}
            requirements have possible resource leads to investigate.
          </p>
        </div>
      </div>
      {result.percent !== null && (
        <progress max={100} value={result.percent} aria-label="Reviewed resource alignment" />
      )}
      <p>
        <strong>{result.blocked} recorded blockers.</strong> A blocker is not offset by a high
        percentage.
      </p>
      {result.percent === 0 && (
        <p>
          No requirement has the current reviewed evidence needed to count yet. This does not mean
          the company has no relevant capabilities.
        </p>
      )}
      <details>
        <summary>How this percentage is calculated</summary>
        <p>{result.formula}</p>
        <p>{result.notice}</p>
        <p>
          The register may still be incomplete. The PDF recalculates from saved records when
          downloaded.
        </p>
      </details>
      <details>
        <summary>Explore job needs and possible company resources</summary>
        <p>
          Suggestions use shared topics in visible records. They are not confirmed capability
          matches and do not change the percentage.
        </p>
        {result.rows.map((row) => (
          <article key={row.requirement.id}>
            <h4>{row.requirement.requirement}</h4>
            <p>{row.status}</p>
            <p>
              <strong>Suggested planning step:</strong> {row.approach}
            </p>
            {row.linked.length > 0 && (
              <p>
                Linked resources: {row.linked.map((e) => e.fact.label).join('; ')}. Review current
                dates and approvals in the requirement.
              </p>
            )}
            {row.suggested.map((s) => (
              <p key={s.fact.id}>
                <Link href={`/company?organization=${data.organization.id}#fact-${s.fact.id}`}>
                  {s.fact.label}
                </Link>{' '}
                — {s.status.replaceAll('_', ' ')}. {s.reason}
              </p>
            ))}
            {!row.suggested.length && !row.linked.length && (
              <p>
                No related resource is available in this view. Add evidence or clarify the delivery
                plan.
              </p>
            )}
            <Link
              href={`/pursuits/${pursuitId}?organization=${data.organization.id}#requirement-${row.requirement.id}`}
            >
              Review this requirement →
            </Link>
          </article>
        ))}
      </details>
    </div>
  );
}
