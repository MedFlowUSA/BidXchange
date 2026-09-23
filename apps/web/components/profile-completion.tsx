'use client';
import { useState } from 'react';
import Link from 'next/link';
import { profileCompletion } from '../lib/profile-completion';
import { workspaceHref } from '../lib/routes';
import type { TenantData } from '../lib/tenant-types';
import { ProfileInformationRequest } from './information-requests';

export default function ProfileCompletion({ data }: { data: TenantData }) {
  const progress = profileCompletion(data.facts, data.reviewAsOf);
  const admin = data.organization.role === 'organization_admin';
  const [missingOnly, setMissingOnly] = useState(true);
  const destination = (section: string, factId?: string) =>
    workspaceHref('/company', data.organization.id) +
    (factId ? `#fact-${factId}` : `#passport-${section}`);
  return (
    <section className="panel" aria-labelledby="profile-completion-title">
      <div className="eyebrow">YOUR COMPANY SETUP</div>
      <h2 id="profile-completion-title">
        {admin ? 'Level-1 profile completion' : 'Visible Level-1 profile fields'}:{' '}
        {progress.percent}%
      </h2>
      <progress
        aria-label="Level-1 profile fields recorded"
        value={progress.completed}
        max={progress.total}
        style={{ width: '100%', height: 18 }}
      />
      <p>
        <strong>
          {progress.completed} of {progress.total} checklist fields recorded.
        </strong>{' '}
        Your saved records update this checklist automatically.
      </p>
      <p>
        Tracks saved profile fields. Evidence review and bid readiness are assessed separately.
        Unknown fields remain incomplete.
      </p>
      {data.organization.role !== 'organization_admin' && (
        <p>
          Your view may exclude restricted records. Ask your administrator to review company-wide
          gaps.
        </p>
      )}
      {data.facts.length >= 500 && (
        <p>Record limit reached: this view may omit additional saved evidence.</p>
      )}
      {progress.next ? (
        <p>
          <Link
            className="button primary"
            href={destination(progress.next.section, progress.next.factId)}
          >
            Continue setup: {progress.next.label}
          </Link>
        </p>
      ) : (
        <p>
          All checklist fields are recorded. Review evidence dates and attestations before reusing
          information.
        </p>
      )}
      <label>
        <input
          type="checkbox"
          checked={missingOnly}
          onChange={(event) => setMissingOnly(event.target.checked)}
        />{' '}
        Show only items with missing fields
      </label>
      <div className="profile-completion-sections">
        {progress.sections.map((section) => (
          <details key={section.id}>
            <summary>
              {section.title} · {section.completed}/{section.total} fields recorded
            </summary>
            {section.items
              .filter((item) => !missingOnly || item.completed < item.total)
              .map((item) => (
                <article key={item.label} style={{ padding: '12px 0' }}>
                  <h3>
                    {item.label} · {item.completed}/{item.total}
                  </h3>
                  <ul>
                    {item.checks
                      .filter((field) => !missingOnly || !field.recorded)
                      .map((field) => (
                        <li key={field.key}>
                          {field.recorded
                            ? 'Recorded'
                            : admin
                              ? 'To add'
                              : 'Not recorded in your visible records'}
                          : {field.label}
                        </li>
                      ))}
                  </ul>
                  {item.legacy && (
                    <p>
                      Earlier unstructured record found. Open Edit saved evidence to organize its
                      details; the original record is retained.
                    </p>
                  )}
                  <p>
                    Evidence review:{' '}
                    {item.review?.replaceAll('_', ' ') ?? 'No matching record visible'}. Field
                    completion does not change this status.
                  </p>
                  <Link href={destination(section.id, item.factId)}>
                    {item.factId
                      ? 'Open saved record'
                      : admin
                        ? 'Add company information'
                        : 'Review Passport question'}
                  </Link>
                  {item.completed < item.total && (
                    <ProfileInformationRequest
                      data={data}
                      section={section.id}
                      item={item.label}
                      missing={item.checks
                        .filter((field) => !field.recorded)
                        .map((field) => field.label)}
                    />
                  )}
                </article>
              ))}
            {missingOnly && section.completed === section.total && (
              <p>No missing fields in this section. Evidence may still need review.</p>
            )}
          </details>
        ))}
      </div>
      <p className="fact-source">
        Checklist: California contractor Level 1. One saved record is assessed per item; conflicting
        records are not combined. Advanced fields can be added when a notice requires them.
      </p>
    </section>
  );
}
