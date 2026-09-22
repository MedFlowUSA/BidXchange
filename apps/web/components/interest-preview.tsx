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
          Bring a public-works, school-facility, municipal or utility bid your company is
          considering. Manuel Rodriguez will walk through how to organize its requirements, review
          company records, identify open questions and assign the next tasks in BidXchange.
        </p>
      </div>
      {demoIntakeConfig() ? (
        <DemoRequestForm />
      ) : (
        <div className={styles.interestForm} role="region" aria-label="Demo contact">
          <h3>Arrange a walkthrough with Manuel</h3>
          <p>
            Send your name, company, work email, trade and counties served. Include the agency,
            school district or utility you want to work with, and a public bid link if you have one.
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
