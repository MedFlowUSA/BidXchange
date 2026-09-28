'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { TenantData } from '../lib/tenant-types';
import { workspaceHref } from '../lib/routes';
import { displayDate } from '../lib/ai/policy';
import BidReportDownload from './bid-report';
import styles from './company-bid-reports.module.css';

export default function CompanyBidReports({ data }: { data: TenantData }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const pursuits = [...data.pursuits].sort((a, b) => a.title.localeCompare(b.title));
  const matches = pursuits.filter((p) => {
    const o = data.opportunities.find((o) => o.id === p.opportunity_id);
    return `${p.title} ${o?.buyer ?? ''} ${o?.solicitation_number ?? ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  });
  const pursuit = matches.find((p) => p.id === selected);
  const notice = data.opportunities.find((o) => o.id === pursuit?.opportunity_id);
  return (
    <div className={styles.reports}>
      <section className="panel" aria-labelledby="company-reports-title">
        <h2 id="company-reports-title">Company bid reports</h2>
        <p>
          Select a saved pursuit to automatically assemble your company information, bid details,
          requirement reviews, saved answers and outstanding tasks into one PDF.
        </p>
        {!pursuits.length ? (
          <>
            <h3>Start with a saved opportunity</h3>
            <p>
              Add the buyer’s notice in Opportunities, then choose Start pursuit. Save its
              requirements and answers there. That pursuit will appear here for report generation.
            </p>
            <p>
              PDFs prepared outside the app do not appear here until their bid records are saved.
            </p>
            <Link
              className="button primary"
              href={workspaceHref('/opportunities', data.organization.id)}
            >
              Open opportunities
            </Link>
          </>
        ) : (
          <>
            <label htmlFor="company-report-search">
              Find a bid by title, buyer or solicitation
            </label>
            <input
              id="company-report-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected('');
              }}
              type="search"
            />
            <label htmlFor="company-report-pursuit">Choose a pursuit</label>
            <select
              id="company-report-pursuit"
              value={pursuit?.id ?? ''}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select a saved pursuit</option>
              {matches.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            {!matches.length && (
              <p role="status">No bids match this search. Try another title or buyer.</p>
            )}
            {data.pursuits.length >= 500 && (
              <p>
                This page shows up to 500 accessible pursuits. Open a pursuit directly to export a
                report if it is not listed here.
              </p>
            )}
            {pursuit && (
              <div className={styles.summary}>
                <h3>{pursuit.title}</h3>
                <p>
                  {notice?.buyer ?? 'Buyer not loaded'} ·{' '}
                  {notice?.solicitation_number ?? 'Solicitation not loaded'}
                </p>
                <p>
                  Deadline:{' '}
                  {notice
                    ? displayDate(notice.official_deadline, notice.deadline_timezone)
                    : 'Open the pursuit for its deadline'}
                </p>
                <Link href={workspaceHref(`/pursuits/${pursuit.id}`, data.organization.id)}>
                  Review requirements and edit answers →
                </Link>
              </div>
            )}
          </>
        )}
      </section>
      {pursuit && (
        <BidReportDownload
          key={`${data.organization.id}:${pursuit.id}:${data.organization.role}`}
          data={data}
          pursuitId={pursuit.id}
          automaticAnswers
        />
      )}
      <p className={styles.note}>
        Reports are generated when requested, using your authorized records. Downloaded files are
        snapshots and do not update themselves. Save changes, then generate again. No report
        approves a requirement, sets a price or submits a bid.
      </p>
    </div>
  );
}
