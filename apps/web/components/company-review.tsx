'use client';
import { useState } from 'react';
import Link from 'next/link';
import { companyReview } from '../lib/company-review';
import { workspaceHref } from '../lib/routes';
import type { TenantData } from '../lib/tenant-types';
import styles from './company-portal.module.css';

export default function CompanyReview({ data }: { data: TenantData }) {
  const { queue, missing } = companyReview(data.facts, data.reviewAsOf);
  const [showAll, setShowAll] = useState(false);
  const admin = data.organization.role === 'organization_admin';
  return (
    <section className="panel" aria-labelledby="company-review-heading">
      <div className={styles.eyebrow}>EVIDENCE FOLLOW-UP</div>
      <h2 id="company-review-heading">Review company evidence</h2>
      <p>
        Check the source, correct the details, then record a human attestation. Website imports and
        saved claims are not automatically approved for a bid.
      </p>
      <p>
        <strong>
          {queue.length} visible {queue.length === 1 ? 'record needs' : 'records need'} attention.
        </strong>{' '}
        Expired and rejected records come first, followed by core contracting evidence.
      </p>
      {!admin && (
        <p>
          Your administrator can edit and attest these records. Use an information request to follow
          up on missing evidence.
        </p>
      )}
      {queue.length ? (
        <ol className={styles.reviewList}>
          {(showAll ? queue : queue.slice(0, 5)).map(({ fact, status, reasons }) => (
            <li key={fact.id}>
              <h3>
                <a href={`#fact-${fact.id}`}>{fact.label}</a>
              </h3>
              <p>
                {status.replaceAll('_', ' ')} · {reasons.join(' ')}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          No visible saved records currently need review. Check the missing fields below and compare
          evidence with each bid’s requirements.
        </p>
      )}
      {queue.length > 5 && (
        <button
          className="button secondary"
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show first five' : `Show all ${queue.length} review items`}
        </button>
      )}
      <details>
        <summary>What still needs to be recorded? ({missing.length} checklist items)</summary>
        <p>
          Based only on records visible here, up to 500. Missing fields are follow-ups, not an
          eligibility finding.
        </p>
        {missing.length ? (
          <ul>
            {missing.map((item) => (
              <li key={`${item.section}-${item.label}`}>
                <a href={item.factId ? `#fact-${item.factId}` : `#passport-${item.section}`}>
                  {item.label}
                </a>
                : {item.fields.join(', ')}
              </li>
            ))}
          </ul>
        ) : (
          <p>All Level-1 checklist fields are recorded. Evidence review remains separate.</p>
        )}
      </details>
      <h3>Use your records on a bid</h3>
      <p>
        Ask the assistant to explain your recorded services and gaps. Then bring in a notice and
        compare its requirements with reviewed evidence.
      </p>
      <div className="quick-links">
        <Link className="button secondary" href={workspaceHref('/assistant', data.organization.id)}>
          Ask about company records
        </Link>{' '}
        <Link
          className="button secondary"
          href={
            workspaceHref('/opportunities', data.organization.id) +
            (admin || data.organization.role === 'capture_manager' ? '#pepma-intake' : '')
          }
        >
          {admin || data.organization.role === 'capture_manager'
            ? 'Add a PEPMA notice'
            : 'View saved opportunities'}
        </Link>
      </div>
    </section>
  );
}
