import styles from './marketing.module.css';
import DemoRequestForm from './demo-request-form';
import { demoIntakeConfig } from '../lib/demo-intake-server';
import { demoContactHref, operationsContact } from '../lib/operations-contact';

export default function InterestPreview() {
  return (
    <section id="request-demo" className={styles.requestSection} aria-labelledby="request-title">
      <div className={styles.requestIntro}>
        <span className={styles.eyebrow}>SEE A SAMPLE BID WORKFLOW</span>
        <h2 id="request-title">Walk through a notice with us.</h2>
        <p>
          Manuel Rodriguez will show you how to record a solicitation, list its requirements, and
          assign the follow-up work using a sample opportunity.
        </p>
      </div>
      {demoIntakeConfig() ? (
        <DemoRequestForm />
      ) : (
        <div className={styles.interestForm} role="region" aria-label="Demo contact">
          <h3>What kind of work do you bid?</h3>
          <p>
            Send your company name, trade or service, and the agencies you want to work with. Leave
            out confidential records.
          </p>
          <a className={styles.primary} href={demoContactHref}>
            Email Manuel to request a demo
          </a>
          <p>Opens your email app; send the message there to request a walkthrough.</p>
          <a href={demoContactHref}>{operationsContact.email}</a>
        </div>
      )}
    </section>
  );
}
