import styles from './marketing.module.css';
import DemoRequestForm from './demo-request-form';
import { demoIntakeConfig } from '../lib/demo-intake-server';
import { demoContactHref, operationsContact } from '../lib/operations-contact';

export default function InterestPreview() {
  return (
    <section id="request-demo" className={styles.requestSection} aria-labelledby="request-title">
      <div className={styles.requestIntro}>
        <span className={styles.eyebrow}>REQUEST A BID REVIEW</span>
        <h2 id="request-title">Bring one live opportunity. See the decision process.</h2>
        <p>
          Bring a public-sector opportunity your company is considering. Manuel Rodriguez will show
          you how BidXchange organizes its requirements, connects relevant company evidence,
          identifies unanswered questions and creates a documented next-action plan.
        </p>
      </div>
      {demoIntakeConfig() ? (
        <DemoRequestForm />
      ) : (
        <div className={styles.interestForm} role="region" aria-label="Demo contact">
          <h3>Arrange a walkthrough with Manuel</h3>
          <p>
            Send your name, company, work email, trade or service, geographic market and the
            agencies or public entities you pursue. An opportunity link and a message are optional.
            Do not email confidential records.
          </p>
          <a className={styles.primary} href={demoContactHref}>
            Email Manuel for a Bid Review
          </a>
          <p>Opens your email app; send the message there to request a walkthrough.</p>
          <a href={demoContactHref}>{operationsContact.email}</a>
        </div>
      )}
    </section>
  );
}
