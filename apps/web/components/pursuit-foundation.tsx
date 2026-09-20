import Link from 'next/link';
export const pursuitSections = [
  'Team and assignments',
  'Compliance matrix',
  'Documents',
  'Questions and clarifications',
  'Proposal sections',
  'Risks',
  'Reviews',
  'Approvals',
  'Submission record',
  'Activity history',
];
export default function PursuitFoundation({
  source,
  deadline,
  timezone,
  opportunityHref,
  demo = false,
  children,
}: {
  source: string;
  deadline: string;
  timezone: string;
  opportunityHref: string;
  demo?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="pursuit-foundation">
      <div className="info-note">
        Final pricing, representations, certifications, and submission authorization remain
        human-controlled. No procurement-portal submission is enabled.
      </div>
      <div className="report-grid">
        <section className="panel">
          <h2>Pursuit overview</h2>
          <p>{demo ? 'Fictional workflow rehearsal.' : 'Response workspace foundation.'}</p>
          <Link href={opportunityHref} className="text-button">
            View linked opportunity →
          </Link>
          <h3>Opportunity source</h3>
          <p>{source}</p>
          <h3>Official deadline</h3>
          <p>
            {deadline} · {timezone}
          </p>
        </section>
        <section className="panel">
          <h2>Bid/no-bid decision</h2>
          <p>
            {demo
              ? 'Demo workflow stage only. No real bid authority is recorded.'
              : 'Pending. A named authorized human approver and decision workflow are required.'}
          </p>
          <span className="fit amber">Live decision workflow not enabled</span>
        </section>
      </div>
      {children}
      <details className="panel" open={demo}>
        <summary>Planned pursuit tools</summary>
        <p>
          These controls are not available yet. Review the linked opportunity and visible tasks
          first; an authorized human must confirm the decision and submission process.
        </p>
        <div className="company-grid">
          {pursuitSections.map((title) => (
            <section className="panel" key={title}>
              <h3>
                {!demo && title === 'Compliance matrix'
                  ? 'Evidence-linked compliance decisions'
                  : title}
              </h3>
              <p>
                {title === 'Submission record'
                  ? 'Not submitted. No automatic submission action.'
                  : title === 'Activity history'
                    ? 'Workflow activity is shown below when available.'
                    : 'Assignment and review controls are planned. This section does not report whether saved records exist.'}
              </p>
              <span className="outline-tag">Foundation</span>
            </section>
          ))}
        </div>
      </details>
    </section>
  );
}
