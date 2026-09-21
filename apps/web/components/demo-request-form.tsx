'use client';

import { useActionState } from 'react';
import { requestDemo } from '../app/demo-request-actions';
import styles from './marketing.module.css';

export default function DemoRequestForm() {
  const [state, action, pending] = useActionState(requestDemo, { message: '' });
  return (
    <form
      action={action}
      className={styles.interestForm}
      aria-label="Request a bid review"
      aria-describedby="demo-data-notice"
    >
      <fieldset disabled={pending || state.success}>
        <legend>Tell us about your company</legend>
        <div className={styles.formGrid}>
          <label>
            Full name
            <input name="name" autoComplete="name" required maxLength={120} />
          </label>
          <label>
            Work email
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label className={styles.fullField}>
            Company name
            <input name="company" autoComplete="organization" required maxLength={200} />
          </label>
          <label className={styles.fullField}>
            Trade, geographic market, agencies or opportunity link <span>(optional)</span>
            <textarea name="message" rows={4} maxLength={1500} />
          </label>
        </div>
        <div hidden aria-hidden="true">
          <label>
            Leave blank
            <input name="website_confirm" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <p id="demo-data-notice">
          BidXchange saves these details so its operations team can review and respond to your demo
          request. Do not include passwords, tax IDs, financial records or confidential bid
          information.
        </p>
        <label className={styles.consent}>
          <input name="consent" value="yes" type="checkbox" required /> You may contact me about
          this request.
        </label>
        <button type="submit" className={styles.primary}>
          {pending ? 'Saving…' : state.success ? 'Request saved' : 'Request a bid review'}
        </button>
      </fieldset>
      <p role="status" aria-live="polite">
        {state.message}
      </p>
    </form>
  );
}
