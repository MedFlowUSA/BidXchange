'use client';
import { useState } from 'react';
import Link from 'next/link';
import { renewalQueue, reviewStatus } from '../lib/company-readiness';
import { workspaceHref } from '../lib/routes';
import type { TenantData } from '../lib/tenant-types';

export default function EvidenceRenewals({ data }: { data: TenantData }) {
  const [expanded, setExpanded] = useState(false);
  const queue = renewalQueue(data.facts, data.reviewAsOf);
  return (
    <section className="panel" aria-labelledby="evidence-renewals-title">
      <div className="eyebrow">COMPANY EVIDENCE</div>
      <h2 id="evidence-renewals-title">Renewals needing attention</h2>
      <p>
        Expired evidence and dates within the next 60 days. Ask the owner for a current source
        before relying on it in a bid.
      </p>
      {!queue.length ? (
        <p>
          No expiration dates in this window are visible to your role. Undated or restricted
          evidence may still need review.
        </p>
      ) : (
        <>
          <ul className="renewal-list">
            {(expanded ? queue : queue.slice(0, 5)).map(({ fact, days }) => (
              <li key={fact.id}>
                <div>
                  <Link href={workspaceHref('/company', data.organization.id) + `#fact-${fact.id}`}>
                    {fact.label}
                  </Link>
                  <p>
                    {days < 0
                      ? `Expired ${Math.abs(days)} days ago`
                      : days === 0
                        ? 'Expires today'
                        : `Expires in ${days} days`}{' '}
                    · {fact.expiration_date}
                  </p>
                  <p>
                    Owner:{' '}
                    {fact.owner_user_id === data.userId
                      ? 'You'
                      : (fact.owner_user_id ?? 'Unassigned')}{' '}
                    · {reviewStatus(fact, data.reviewAsOf).replaceAll('_', ' ')}
                  </p>
                </div>
                <Link
                  className="button secondary"
                  href={workspaceHref('/company', data.organization.id) + `#fact-${fact.id}`}
                >
                  Review evidence
                </Link>
              </li>
            ))}
          </ul>
          {queue.length > 5 && (
            <button
              className="button secondary"
              type="button"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show fewer' : `Show all ${queue.length} visible renewals`}
            </button>
          )}
        </>
      )}
      <p className="fact-source">
        As of {data.reviewAsOf.slice(0, 10)} (UTC date). Based on up to 500 company entries visible
        to your role. These reminders do not change saved verification or certify eligibility.
      </p>
    </section>
  );
}
