'use client';
import { useState } from 'react';
import Link from 'next/link';
import { workspaceHref } from '../lib/routes';
import type { TenantData } from '../lib/tenant-types';
import { freshnessRadar } from '../lib/california-passport';

export default function EvidenceRenewals({ data }: { data: TenantData }) {
  const [expanded, setExpanded] = useState(false);
  const radar = freshnessRadar(data.facts, data.reviewAsOf);
  const [filter, setFilter] = useState('all');
  const attention = radar.filter(
    (r) => r.window || r.stale || r.missingChecked || r.missingExpiration,
  );
  const shown = attention.filter(
    (r) =>
      filter === 'all' ||
      r.window === filter ||
      (filter === 'stale' && r.stale) ||
      (filter === 'missing' && (r.missingChecked || r.missingExpiration)),
  );
  return (
    <section className="panel" aria-labelledby="evidence-renewals-title">
      <div className="eyebrow">COMPANY EVIDENCE</div>
      <h2 id="evidence-renewals-title">Expiration and freshness Radar</h2>
      <label>
        Radar window{' '}
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All attention items</option>
          <option value="expired">Already expired</option>
          <option value="30">Expires in 0–30 days</option>
          <option value="60">Expires in 31–60 days</option>
          <option value="90">Expires in 61–90 days</option>
          <option value="stale">Last checked over 90 days ago</option>
          <option value="missing">Missing dates</option>
        </select>
      </label>
      <ul>
        {shown.slice(0, expanded ? 500 : 5).map((r) => (
          <li key={r.fact.id}>
            <Link href={workspaceHref('/company', data.organization.id) + `#fact-${r.fact.id}`}>
              {r.fact.label}
            </Link>
            <p>
              {r.window === 'expired'
                ? 'Expired'
                : r.days !== null
                  ? `Expiration in ${r.days} days`
                  : 'Expiration not recorded'}{' '}
              · Last checked: {r.checked || 'Not recorded'}
              {r.stale ? ' · Needs review: last checked over 90 days ago' : ''}
            </p>
            <p>
              Attested by:{' '}
              {r.fact.verified_by === data.userId ? 'You' : r.fact.verified_by || 'Not attested'} ·
              Owner:{' '}
              {r.fact.owner_user_id === data.userId ? 'You' : r.fact.owner_user_id || 'Unassigned'}
            </p>
          </li>
        ))}
      </ul>
      {!shown.length && (
        <p>No records match this window. Missing or restricted evidence may still need review.</p>
      )}
      {shown.length > 5 && (
        <button className="button secondary" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer Radar items' : 'Show all Radar items'}
        </button>
      )}
      <p>
        Last checked uses the recorded source-check date when supplied, otherwise the existing
        human-attestation date. Record presence is not a qualification finding.
      </p>
      <p className="fact-source">
        As of {data.reviewAsOf.slice(0, 10)} (UTC date). Based on up to 500 company entries visible
        to your role. Human review is required. When the contractor workflow is enabled, opening an
        affected pursuit reopens requirements linked to stale or expired evidence and creates an
        owner follow-up task. Earlier decisions remain in history.
      </p>
    </section>
  );
}
