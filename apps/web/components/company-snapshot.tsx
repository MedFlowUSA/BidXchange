'use client';
import { Building2, MapPin, Wrench, FileCheck2, Users } from 'lucide-react';
import { reviewStatus } from '../lib/company-readiness';
import { reviewedPortalUrl } from '../lib/sources/portal-url';
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
        ) ||
        (fact.fact_type === 'identity' &&
          /^(business (mailing address|phone|email)|headquarters|address)$/i.test(fact.label)),
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
    {
      title: 'Licenses & registrations',
      icon: FileCheck2,
      destination: '#passport-licenses',
      empty: 'Keep license and registration claims with their supporting records.',
      matches: (fact: Fact) =>
        ['license', 'registration', 'federal', 'certification', 'naics'].includes(fact.fact_type),
    },
    {
      title: 'Experience & team',
      icon: Users,
      destination: '#company-records',
      empty: 'Add past work and team information that your company can support.',
      matches: (fact: Fact) =>
        ['experience', 'past_performance', 'personnel'].includes(fact.fact_type),
    },
  ];
  const website = reviewedPortalUrl(data.organization.website);
  const savedDates = [data.companyProfile?.updated_at, ...data.facts.map((f) => f.updated_at)]
    .filter((stamp): stamp is string => !!stamp && Number.isFinite(Date.parse(stamp)))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const record = (fact: Fact) => (
    <li key={fact.id}>
      <a href={`#fact-${fact.id}`}>{fact.label}</a>
      <p className={styles.recordValue}>{fact.value?.trim() || 'Details not recorded yet.'}</p>
      <span className={styles.recordStatus}>
        Evidence: {reviewStatus(fact, data.reviewAsOf).replaceAll('_', ' ')}
      </span>
    </li>
  );
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
      <div className={styles.savedProfile}>
        <p>
          <strong>Legal name:</strong> {data.organization.legal_name}
        </p>
        {website && (
          <p>
            <strong>Website:</strong>{' '}
            <a href={website} target="_blank" rel="noopener noreferrer">
              {website} (external)
            </a>
          </p>
        )}
        {data.companyProfile?.summary?.trim() ? (
          <>
            <h3>About the company</h3>
            <p className={styles.profileSummary}>{data.companyProfile.summary}</p>
            <p className={styles.snapshotNote}>
              Saved company description. Confirm its claims before using it in a bid.
            </p>
          </>
        ) : (
          <p>
            No company description is saved yet. The records below show the details available to
            your role.
          </p>
        )}
        {savedDates[0] && (
          <p className={styles.snapshotNote}>
            Latest saved update:{' '}
            {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(
              new Date(savedDates[0]),
            )}{' '}
            (UTC). Saving a record does not attest it.
          </p>
        )}
      </div>
      <p className={styles.snapshotNote}>
        Saved records visible to you, with recent updates first. Open a record to check its source
        or edit its details. Expand each category to see the remaining records.
      </p>
      <div className={styles.snapshotGrid}>
        {groups.map(({ title, icon: Icon, destination, empty, matches }) => {
          const facts = data.facts
            .filter(matches)
            .sort((a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0));
          return (
            <article key={title} className={styles.snapshotCard}>
              <h3>
                <Icon size={17} aria-hidden="true" />
                {title}
              </h3>
              {facts.length ? (
                <>
                  <ul>{facts.slice(0, 3).map(record)}</ul>
                  {facts.length > 3 && (
                    <details>
                      <summary>Show {facts.length - 3} more records</summary>
                      <ul>{facts.slice(3).map(record)}</ul>
                    </details>
                  )}
                </>
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
