'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { passportSteps } from '../lib/company-passport';
import { reviewStatus } from '../lib/company-readiness';
import { passportRecords } from '../lib/passport-records';
import type { TenantData } from '../lib/tenant-types';
import CompanyRecordForm from './company-record-form';
import styles from './company-passport.module.css';

export default function CompanyPassport({ data }: { data: TenantData }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const resume = () => {
      const found = passportSteps.findIndex((step) => location.hash === `#passport-${step.id}`);
      if (found >= 0) setIndex(found);
    };
    resume();
    window.addEventListener('hashchange', resume);
    return () => window.removeEventListener('hashchange', resume);
  }, []);
  const admin = data.organization.role === 'organization_admin';
  return (
    <section className={`panel ${styles.passport}`} aria-labelledby="passport-title">
      <div className="eyebrow">COMPANY PASSPORT</div>
      <h2 id="passport-title">Build the company information behind your bids.</h2>
      <p>
        Work through one area at a time. Save what you can support and leave unknown answers blank.
        Each save stays with this company for later review.
      </p>
      <p className={styles.note}>
        These are suggested questions, not a completeness score. Only information your role can
        access is shown. Saving does not verify a claim or approve proposal use.
      </p>
      <nav className={styles.steps} aria-label="Company Passport steps">
        {passportSteps.map((step, i) => (
          <a
            href={`#passport-${step.id}`}
            key={step.id}
            aria-current={i === index ? 'step' : undefined}
            onClick={() => setIndex(i)}
          >
            {i + 1}
            <span>
              {step.id === 'assets'
                ? 'Evidence'
                : step.id === 'territory'
                  ? 'Location'
                  : step.id.charAt(0).toUpperCase() + step.id.slice(1)}
            </span>
          </a>
        ))}
      </nav>
      {passportSteps.map((step, i) => (
        <div id={`passport-${step.id}`} key={step.id} hidden={i !== index} className={styles.step}>
          <p className="eyebrow">
            QUESTION {i + 1} OF {passportSteps.length}
          </p>
          <h3>{step.question}</h3>
          <p>
            <strong>Why it matters:</strong> {step.why}
          </p>
          {!admin && (
            <p>
              Your company administrator can add answers. You can review the information visible to
              your role below.
            </p>
          )}
          {step.items.map((suggestion) => {
            const saved = passportRecords(data.facts, suggestion);
            return (
              <div key={suggestion.label} className={styles.item}>
                {saved.length ? (
                  <>
                    <h4>{suggestion.label}</h4>
                    <p>
                      {saved.length} related saved {saved.length === 1 ? 'record' : 'records'}.
                      Confirm the scope and missing fields before relying on them.
                    </p>
                    <ul>
                      {saved.map((fact) => (
                        <li key={fact.id}>
                          <Link href={`#fact-${fact.id}`}>{fact.label}</Link> —{' '}
                          {reviewStatus(fact, data.reviewAsOf).replaceAll('_', ' ')}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : admin ? (
                  <CompanyRecordForm
                    organizationId={data.organization.id}
                    types={[suggestion.type]}
                    members={data.members}
                    userId={data.userId}
                    suggestion={suggestion}
                    structuredEnabled={data.structuredProfilesEnabled}
                  />
                ) : (
                  <>
                    <h4>{suggestion.label}</h4>
                    <p>{suggestion.prompt}</p>
                  </>
                )}
              </div>
            );
          })}
          <div className={styles.controls}>
            {i > 0 && (
              <a
                className="button secondary"
                href={`#passport-${passportSteps[i - 1].id}`}
                onClick={() => setIndex(i - 1)}
              >
                Previous question
              </a>
            )}
            {i < passportSteps.length - 1 ? (
              <a
                className="button primary"
                href={`#passport-${passportSteps[i + 1].id}`}
                onClick={() => setIndex(i + 1)}
              >
                Next question
              </a>
            ) : (
              <a className="button primary" href="#company-readiness">
                Review saved evidence
              </a>
            )}
          </div>
          <p className={styles.note}>
            Next moves between questions; it does not save or mark an area complete. Use Save
            evidence record before leaving the page. Open drafts stay here while you switch
            questions.
          </p>
        </div>
      ))}
    </section>
  );
}
