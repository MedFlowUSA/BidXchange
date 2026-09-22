'use client';
import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { deliveryReview } from '../lib/delivery-review';
import { TaskForm } from './capture-forms';
import styles from './contract-readiness-brief.module.css';

export default function DeliveryReview({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const checks = deliveryReview(data, pursuitId);
  if (!checks.length) return null;
  const canAssign = ['organization_admin', 'capture_manager'].includes(data.organization.role);
  return (
    <section className="panel" id="delivery-review" aria-labelledby="delivery-review-title">
      <div className="eyebrow">Before committing resources</div>
      <h2 id="delivery-review-title">Can your team deliver this work?</h2>
      <p>
        Compare company records with this project’s scope and performance dates. These records are
        company-wide; their presence does not confirm availability for this pursuit.
      </p>
      <p>
        <Link href={`/company?organization=${data.organization.id}#company-readiness`}>
          Update staffing, equipment and financial records
        </Link>
      </p>
      {data.facts.length >= 500 && (
        <p className="info-note">
          The visible record limit was reached. Review the full company register before concluding a
          record is missing.
        </p>
      )}
      <div className={styles.grid}>
        {checks.map((check) => (
          <div key={check.id}>
            <h3>{check.title}</h3>
            <p>{check.question}</p>
            {!check.records.length && (
              <p>
                {check.kind
                  ? 'No structured record is visible for this check. Legacy or restricted records may need separate review.'
                  : 'Quote evidence requires a separate human review.'}
              </p>
            )}
            {check.records.length > 0 && (
              <details>
                <summary>{check.records.length} visible company records</summary>
                <ul>
                  {check.records.map(({ fact, status }) => (
                    <li key={fact.id}>
                      <strong>{fact.label}</strong>
                      <p>
                        Record status: {status.replaceAll('_', ' ')} · Source:{' '}
                        {fact.source_reference || 'Not recorded'}
                      </p>
                      <p>
                        Updated: {fact.updated_at} · Expires:{' '}
                        {fact.expiration_date || 'Not recorded'}
                      </p>
                      <p>{fact.value || 'No value recorded'}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {canAssign && (
              <TaskForm data={data} pursuitId={pursuitId} suggestedTitle={check.task} />
            )}
          </div>
        ))}
      </div>
      <p>
        Follow-ups are saved as pursuit tasks with an owner and deadline. Check existing tasks
        before adding another. Task completion is not delivery approval, a capacity forecast or a
        profitability calculation.
      </p>
      <Link href={`/pursuits/${pursuitId}?organization=${data.organization.id}#pursuit-tasks`}>
        Review assigned delivery work
      </Link>
    </section>
  );
}
