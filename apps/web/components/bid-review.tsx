'use client';
import Link from 'next/link';
import { bidReview, bidReviewText } from '../lib/bid-review';
import type { TenantData } from '../lib/tenant-types';

export default function BidReview({ data, pursuitId }: { data: TenantData; pursuitId: string }) {
  const review = bidReview(data, pursuitId);
  function download() {
    const url = URL.createObjectURL(
      new Blob([bidReviewText(data, pursuitId)], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bidxchange-bid-review.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel decision-brief" aria-labelledby="bid-review-heading">
      <div className="eyebrow">Your bid review</div>
      <h2 id="bid-review-heading">From source wording to a decision you can explain</h2>
      <p>
        Read the notice, connect company evidence, resolve the gaps, then record the human decision.
        Each step uses the saved records below.
      </p>
      <nav className="hero-actions" aria-label="Bid review steps">
        <Link
          href={
            ['organization_admin', 'capture_manager'].includes(data.organization.role)
              ? '#notice-intake'
              : '#requirements-heading'
          }
        >
          1. Source requirements
        </Link>
        <Link href="#decision-brief-heading">2. Evidence and gaps</Link>
        <Link href="#pursuit-tasks">3. Assigned actions</Link>
        <Link href="#bid-decision">4. Human decision</Link>
        <Link href="#response-packages">5. Response package</Link>
      </nav>
      <p>
        <strong>{review.rows.length}</strong> visible requirements ·{' '}
        <strong>{review.unresolved.length}</strong> without current resolution ·{' '}
        <strong>{review.missingOwners.length}</strong> without an owner ·{' '}
        <strong>{review.tasks.length}</strong> visible open actions
      </p>

      {review.staleDecision && (
        <p role="status">
          The saved decision needs another review because its context changed or is unavailable.
        </p>
      )}
      {review.partial && (
        <p role="status">
          Partial register: a record limit was reached. These counts cannot describe the full
          pursuit.
        </p>
      )}
      <p>
        Counts describe review work, not eligibility. The notice may contain obligations that have
        not been recorded. Restricted evidence may be outside your view; task lists use bounded
        samples.
      </p>
      <button className="button secondary" type="button" onClick={download}>
        Download review brief
      </button>
      <p>
        The brief contains visible workspace information and human decisions. Share only with
        authorized recipients.
      </p>
    </section>
  );
}
