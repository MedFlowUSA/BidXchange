import styles from './marketing.module.css';
import DemoRequestForm from './demo-request-form';
import { demoIntakeConfig } from '../lib/demo-intake-server';
import { demoContactHref, operationsContact } from '../lib/operations-contact';

export default function InterestPreview() {
  return (
    <section id="request-demo" className={styles.requestSection} aria-labelledby="request-title">
      <div className={styles.requestIntro}>
        <span className={styles.eyebrow}>PUT THE WORKFLOW TO THE TEST</span>
        <h2 id="request-title">From “should we bid?” to a documented decision.</h2>
        <p>
          Walk through a sample solicitation with Manuel Rodriguez. See how a requirement connects
          to company evidence, an open question gets an owner, and your team records its decision.
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
