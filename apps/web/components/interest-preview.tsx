import styles from './marketing.module.css';
import DemoRequestForm from './demo-request-form';
import { demoIntakeConfig } from '../lib/demo-intake-server';
import { demoContactHref, operationsContact } from '../lib/operations-contact';

export default function InterestPreview() {
  return (
    <section id="request-demo" className={styles.requestSection} aria-labelledby="request-title">
      <div className={styles.requestIntro}>
        <span className={styles.eyebrow}>LET’S TALK ABOUT YOUR NEXT STEP</span>
        <h2 id="request-title">A better-organized pursuit starts here.</h2>
        <p>Walk through BidXchange with Manuel Rodriguez and see how it could fit your team.</p>
      </div>
      {demoIntakeConfig() ? (
        <DemoRequestForm />
      ) : (
        <div className={styles.interestForm} role="region" aria-label="Demo contact">
          <h3>Tell us about your company.</h3>
          <p>
            Share your company name and what you would like help with. Leave out confidential
            records.
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
