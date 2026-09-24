'use client';
import { Building2, MapPin, Wrench } from 'lucide-react';
import { reviewStatus } from '../lib/company-readiness';
import type { Fact, TenantData } from '../lib/tenant-types';
import styles from './company-portal.module.css';

// Display only the already-authorized snapshot. Never infer approval or combine conflicting claims.
export default function CompanySnapshot({ data }: { data: TenantData }) {
  const groups = [
    {
      title: 'Contact & location',
      icon: Building2,
      destination: '#passport-identity',
      empty: 'Keep business contact details handy for response forms.',
      matches: (fact: Fact) =>
        ['mailing_address', 'business_phone', 'business_email'].includes(
          fact.structured_kind ?? '',
        ),
    },
    {
      title: 'Work performed',
      icon: Wrench,
      destination: '#passport-territory',
      empty: 'Describe your services so the team can compare them with a notice.',
      matches: (fact: Fact) => fact.fact_type === 'capability',
    },
    {
      title: 'Service area',
      icon: MapPin,
      destination: '#passport-territory',
      empty: 'Record where your company works to help screen project locations.',
      matches: (fact: Fact) => ['territory', 'service_territory'].includes(fact.fact_type),
    },
  ];
  return (
    <section className="panel" aria-labelledby="company-snapshot-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>AT A GLANCE</span>
          <h2 id="company-snapshot-title">Your company details</h2>
        </div>
        <a href="#company-edit">
          {data.organization.role === 'organization_admin' ? 'Edit profile' : 'View profile'}
        </a>
      </div>
      <p className={styles.snapshotNote}>
        A selection of saved records visible to you. Open a record to check its details and source.
      </p>
      <div className={styles.snapshotGrid}>
        {groups.map(({ title, icon: Icon, destination, empty, matches }) => {
          const facts = data.facts.filter(matches).slice(0, 2);
          return (
            <article key={title} className={styles.snapshotCard}>
              <h3>
                <Icon size={17} aria-hidden="true" />
                {title}
              </h3>
              {facts.length ? (
                <ul>
                  {facts.map((fact) => (
                    <li key={fact.id}>
                      <a href={`#fact-${fact.id}`}>{fact.label}</a>
                      <p className={styles.recordValue}>
                        {fact.value?.trim() || 'Details not recorded yet.'}
                      </p>
                      <span className={styles.recordStatus}>
                        Evidence: {reviewStatus(fact, data.reviewAsOf).replaceAll('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <p>No matching records visible yet. {empty}</p>
                  <a href={destination}>Open profile section</a>
                </>
              )}
            </article>
          );
        })}
      </div>
      <a className={styles.allRecords} href="#company-records">
        Browse all saved records →
      </a>
    </section>
  );
}
