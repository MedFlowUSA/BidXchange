import styles from './marketing.module.css';
import DemoRequestForm from './demo-request-form';
import { demoIntakeConfig } from '../lib/demo-intake-server';
import { demoContactHref, operationsContact } from '../lib/operations-contact';

export default function InterestPreview() {
  return (
    <section id="request-demo" className={styles.requestSection} aria-labelledby="request-title">
      <div className={styles.requestIntro}>
        <span className={styles.eyebrow}>LET’S FIND YOUR NEXT STEP</span>
        <h2 id="request-title">See how BidXchange could work for your company.</h2>
        <p>
          A focused conversation about your work, your market, and the kind of opportunities worth
          your time.
        </p>
        <div className={styles.requestNotice}>
          <strong>Your contact: {operationsContact.name}</strong>
          <p>
            <a href={demoContactHref}>{operationsContact.email}</a>
          </p>
          <p>
            Email your company name and what you would like help with. Please leave out confidential
            records.
          </p>
        </div>
        <p className={styles.existingAccount}>
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
      {demoIntakeConfig() ? (
        <DemoRequestForm />
      ) : (
        <div className={styles.interestForm} role="region" aria-label="Demo contact">
          <h3>Start a conversation</h3>
          <p>Request a walkthrough with Manuel Rodriguez, our initial operations contact.</p>
          <a className={styles.primary} href={demoContactHref}>
            Email Manuel to request a demo
          </a>
          <p>
            This opens your email app. Review and send the message there; clicking this link does
            not send a request or save it in BidXchange.
          </p>
          <a href="/dashboard?workspace=demo">Explore the fictional demo →</a>
        </div>
      )}
    </section>
  );
}
