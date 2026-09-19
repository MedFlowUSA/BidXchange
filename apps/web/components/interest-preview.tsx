import styles from './marketing.module.css';

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
        <div className={styles.requestNotice} id="interest-preview-notice">
          <strong>Demo requests are opening soon.</strong>
          <p>
            This form is a preview. Requests are not being accepted yet, and no personal information
            is collected or sent.
          </p>
          <a href="/dashboard?workspace=demo">Explore the fictional demo in the meantime →</a>
        </div>
        <p className={styles.existingAccount}>
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
      <div
        role="form"
        className={styles.interestForm}
        aria-label="Demo request preview"
        aria-describedby="interest-preview-notice"
      >
        <fieldset disabled>
          <legend>Your company, your next opportunity</legend>
          <div className={styles.intentChoices}>
            <label>
              <input type="radio" name="intent" value="demo" defaultChecked /> Request a Demo
            </label>
            <label>
              <input type="radio" name="intent" value="beta" /> Join the Beta
            </label>
          </div>
          <div className={styles.formGrid}>
            <label>
              Full name
              <input
                name="full_name"
                autoComplete="name"
                maxLength={120}
                required
                placeholder="Your name"
              />
            </label>
            <label>
              Work email
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                placeholder="you@company.com"
              />
            </label>
            <label>
              Phone number <span>(optional)</span>
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={40}
                placeholder="Business phone"
              />
            </label>
            <label>
              Company name
              <input
                name="company"
                autoComplete="organization"
                maxLength={200}
                required
                placeholder="Company name"
              />
            </label>
            <label className={styles.fullField}>
              Website <span>(optional)</span>
              <input
                name="website"
                type="url"
                autoComplete="url"
                maxLength={500}
                placeholder="https://"
              />
            </label>
            <label>
              Primary service category
              <select name="category" required defaultValue="">
                <option value="" disabled>
                  Select a category
                </option>
                {[
                  'General contracting',
                  'Specialty contracting',
                  'Energy and utilities',
                  'Facilities and maintenance',
                  'Public works',
                  'Professional services',
                  'Supplies',
                  'Other',
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Geographic market
              <input
                name="market"
                maxLength={200}
                required
                placeholder="Regions or states served"
              />
            </label>
            <label className={styles.fullField}>
              Government-contracting experience
              <select name="experience" required defaultValue="">
                <option value="" disabled>
                  Select your experience
                </option>
                <option>Exploring government work</option>
                <option>Some public-sector experience</option>
                <option>Established government contractor</option>
              </select>
            </label>
            <label className={styles.fullField}>
              Short message <span>(optional)</span>
              <textarea
                name="message"
                maxLength={1500}
                rows={3}
                placeholder="What would you like to accomplish?"
              />
            </label>
          </div>
          <label className={styles.consent}>
            <input name="consent" type="checkbox" required /> I acknowledge the privacy notice
            (publication pending).
          </label>
          <button type="button" disabled className={styles.submitPreview}>
            Requests opening soon
          </button>
        </fieldset>
      </div>
    </section>
  );
}
