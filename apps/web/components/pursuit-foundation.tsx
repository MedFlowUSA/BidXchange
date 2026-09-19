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
      <div className="company-grid">
        {pursuitSections.map((title) => (
          <section className="panel" key={title}>
            <h3>{title}</h3>
            <p>
              {title === 'Submission record'
                ? 'Not submitted. No automatic submission action.'
                : title === 'Activity history'
                  ? 'Workflow activity is shown below when available.'
                  : 'No records yet. Assignment and review controls will be added in the pursuit workflow phase.'}
            </p>
            <span className="outline-tag">Foundation</span>
          </section>
        ))}
      </div>
    </section>
  );
}
