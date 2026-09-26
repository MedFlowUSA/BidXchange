'use client';
import Link from 'next/link';
import { useDemoPassport } from './demo-passport-state';

export default function DemoPassport() {
  const { insuranceCurrent, setInsuranceCurrent } = useDemoPassport();
  const records = [
    [
      'Company identity',
      'Apex Energy Demo LLC · DBA Apex Energy · Redlands, CA',
      'Attested',
      'Not applicable',
    ],
    [
      'CSLB license and class',
      'DEMO-ONLY · B / C-10 · electrical and energy-efficiency work',
      'Attested',
      '2026-12-31',
    ],
    ['DIR public-works registration', 'DEMO-ONLY · active as claimed', 'Attested', '2027-06-30'],
    ['SAM / UEI', 'DEMO-ONLY · active as claimed', 'Attested', '2026-12-20'],
    [
      'Service territory',
      'San Bernardino and Riverside counties · 60 miles from Redlands',
      'Attested',
      'Not applicable',
    ],
    [
      'NAICS and services',
      '238210 · Electrical, lighting and building controls',
      'Attested',
      'Not applicable',
    ],
    [
      'Single-project bonding',
      '$1M–$2M band · bid bond capability claimed',
      'Attested',
      'Review for each bid',
    ],
    ['Aggregate bonding', 'Available capacity not recorded', 'Needs review', 'Review for each bid'],
    [
      'General liability insurance',
      insuranceCurrent
        ? 'Renewal recorded; review requested endorsements'
        : 'Previous policy expired',
      insuranceCurrent ? 'Attested' : 'Expired',
      insuranceCurrent ? '2027-09-25' : '2026-09-01',
    ],
    ['Workers’ compensation', 'Policy dates recorded', 'Attested', '2026-10-20'],
    ['Commercial auto', 'Policy dates recorded', 'Attested', '2026-11-15'],
    [
      'Past project 1',
      'Canyon Civic Hall · prime · $250k–$500k · 2025 · lighting retrofit · Redlands · disclosure permitted',
      'Attested',
      'Not applicable',
    ],
    [
      'Past project 2',
      'Mesa Facilities · subcontractor · $100k–$250k · 2024 · building controls · Riverside · disclosure permitted',
      'Attested',
      'Not applicable',
    ],
    [
      'Past project 3',
      'Valley Community Center · prime · $100k–$250k · 2023 · LED conversion · San Bernardino · disclosure permitted',
      'Attested',
      'Not applicable',
    ],
  ];
  return (
    <div className="bid-workspace">
      <section className="panel" id="passport-radar">
        <div className="eyebrow">EXPIRATION AND FRESHNESS RADAR</div>
        <h2>Keep the evidence current</h2>
        <p>Illustrated as of September 26, 2026. Review dates against each new notice.</p>
        <div className="radar-grid">
          <div>
            <b>Expired</b>
            <p>{insuranceCurrent ? 'None' : 'General liability · Sep 1'}</p>
          </div>
          <div>
            <b>Within 30 days</b>
            <p>Workers’ compensation · Oct 20</p>
          </div>
          <div>
            <b>31–60 days</b>
            <p>Commercial auto · Nov 15</p>
          </div>
          <div>
            <b>61–90 days</b>
            <p>SAM claimed renewal · Dec 20</p>
          </div>
        </div>
        <p>
          Used by the municipal retrofit: CSLB, DIR, bonding, general liability and past projects.
        </p>
        <p>
          Next item: ask the surety for current aggregate availability. Re-review the insurance
          requirement after renewal.
        </p>
        <button className="button" onClick={() => setInsuranceCurrent(!insuranceCurrent)}>
          {insuranceCurrent ? 'Simulate insurance expiration' : 'Simulate insurance renewal'}
        </button>{' '}
        <Link className="button primary" href="/pursuits/DEMO-001?workspace=demo">
          Open municipal retrofit
        </Link>
      </section>
      <section className="panel">
        <h2>Level-1 Passport</h2>
        <p>Company, registrations, territory, coverage and three projects. No uploads needed.</p>
        {records.map(([title, value, status, expiration]) => (
          <details className="passport-record" key={title}>
            <summary>
              <span>{title}</span>
              <span>{status}</span>
            </summary>
            <p>{value}</p>
            <dl>
              <dt>Source</dt>
              <dd>Sample company record · source note entered by Alex</dd>
              <dt>Last checked</dt>
              <dd>September 25, 2026</dd>
              <dt>Expiration</dt>
              <dd>{expiration}</dd>
              <dt>Attested by</dt>
              <dd>
                {status === 'Attested' ? 'Alex · September 25, 2026' : 'New attestation needed'}
              </dd>
            </dl>
          </details>
        ))}
      </section>
      <Link href="/documents?workspace=demo">Company documents →</Link>
    </div>
  );
}
