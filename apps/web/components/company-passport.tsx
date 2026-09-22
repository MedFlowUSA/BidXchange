'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { passportSteps } from '../lib/company-passport';
import { californiaPassportSteps } from '../lib/california-passport';
import { reviewStatus } from '../lib/company-readiness';
import { passportRecords } from '../lib/passport-records';
import type { TenantData } from '../lib/tenant-types';
import CompanyRecordForm from './company-record-form';
import styles from './company-passport.module.css';

export default function CompanyPassport({ data }: { data: TenantData }) {
  const [index, setIndex] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const steps = advanced ? passportSteps : californiaPassportSteps;
  useEffect(() => {
    const resume = () => {
      const found = steps.findIndex((step) => location.hash === `#passport-${step.id}`);
      if (found >= 0) setIndex(found);
    };
    resume();
    window.addEventListener('hashchange', resume);
    return () => window.removeEventListener('hashchange', resume);
  }, [steps]);
  const admin = data.organization.role === 'organization_admin';
  return (
    <section className={`panel ${styles.passport}`} aria-labelledby="passport-title">
      <div className="eyebrow">COMPANY PASSPORT</div>
      <h2 id="passport-title">California Contractor Passport</h2>
      <p>
        Level 1: company, registrations, license, territory, bonding, insurance and three projects.
        No uploads required. Save unknowns for later.
      </p>
      <button
        className="button secondary"
        onClick={() => {
          setAdvanced(!advanced);
          setIndex(0);
        }}
      >
        {advanced ? 'Return to Level 1' : 'Add when needed: advanced evidence'}
      </button>
      <p>
        Work through one area at a time. Save what you can support and leave unknown answers blank.
        Each save stays with this company for later review.
      </p>
      <p className={styles.note}>
        These are suggested questions for the Level-1 field checklist. Only information your role
        can access is shown. Saving does not verify a claim or approve proposal use.
      </p>
      <nav className={styles.steps} aria-label="Company Passport steps">
        {steps.map((step, i) => (
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
      {steps.map((step, i) => (
        <div id={`passport-${step.id}`} key={step.id} hidden={i !== index} className={styles.step}>
          <p className="eyebrow">
            QUESTION {i + 1} OF {steps.length}
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
                    {admin && saved.every((fact) => fact.fact_type !== suggestion.type) && (
                      <>
                        <p>
                          These earlier records remain available. Add the structured details below
                          to complete this Passport item.
                        </p>
                        <CompanyRecordForm
                          organizationId={data.organization.id}
                          types={[suggestion.type]}
                          members={data.members}
                          userId={data.userId}
                          suggestion={suggestion}
                          structuredEnabled={data.structuredProfilesEnabled}
                        />
                      </>
                    )}
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
                href={`#passport-${steps[i - 1].id}`}
                onClick={() => setIndex(i - 1)}
              >
                Previous question
              </a>
            )}
            {i < steps.length - 1 ? (
              <a
                className="button primary"
                href={`#passport-${steps[i + 1].id}`}
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
