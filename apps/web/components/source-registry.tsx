'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CaptureForm } from './capture-forms';
import { sourceRegistry, connectionLabels, type SourceDefinition } from '../lib/sources/registry';
import {
  detailFields,
  manualAdapter,
  readNormalized,
  scheduleEligible,
  type SourceRegistration,
} from '../lib/sources/normalized';
import { saveNormalizedOpportunity, saveSourceRegistration } from '../app/registry-actions';
import type { LiveOpportunity } from '../lib/tenant-types';
import styles from './pepma-workflow.module.css';
import PortalShortcuts from './portal-shortcuts';
import { reviewedPortalUrl } from '../lib/sources/portal-url';

export function SourceOpportunityForm({
  org,
  source,
  opportunity,
}: {
  org: string;
  source: SourceDefinition;
  opportunity?: LiveOpportunity;
}) {
  const details = readNormalized(opportunity?.source_details);
  const initial = {
    title: opportunity?.title ?? '',
    buyer: opportunity?.buyer ?? '',
    solicitation_number: opportunity?.solicitation_number ?? '',
    source_url: opportunity?.source_url ?? '',
    source_note: opportunity?.source_note ?? '',
    summary: opportunity?.summary ?? '',
    official_deadline: opportunity?.official_deadline ?? '',
    deadline_timezone: opportunity?.deadline_timezone ?? 'America/Los_Angeles',
    estimated_value: opportunity?.estimated_value?.toString() ?? '',
    confirmed: '',
    ...Object.fromEntries(
      Object.keys(detailFields).map((key) => [
        key,
        details?.[key as keyof typeof detailFields] ?? '',
      ]),
    ),
    publishedAt: details?.publishedAt ?? '',
    questionDeadline: details?.questionDeadline ?? '',
    siteVisit: details?.siteVisit ?? '',
    preBidMeeting: details?.preBidMeeting ?? '',
    submissionUrl: details?.submissionUrl ?? '',
  };
  return (
    <CaptureForm
      label={opportunity ? 'Edit source details' : 'Record source opportunity'}
      hidden={{
        organization_id: org,
        record_id: opportunity?.id ?? '',
        updated_at: opportunity?.updated_at ?? '',
      }}
      initial={initial}
      action={async (state, form) => {
        try {
          const fields = Object.fromEntries(
            [
              ...Object.keys(detailFields),
              'publishedAt',
              'questionDeadline',
              'siteVisit',
              'preBidMeeting',
              'submissionUrl',
            ].map((key) => [key, String(form.get(key) ?? '')]),
          );
          form.set('details', JSON.stringify(manualAdapter(source.id).normalize(fields)));
          return await saveNormalizedOpportunity(state, form);
        } catch {
          return {
            message: 'Check the source dates and URLs. Use explicit UTC offsets for timestamps.',
          };
        }
      }}
      note="Manually reviewed intake. All workspace members can read these fields. Enter only authorized business details. Dates require an explicit UTC offset, for example 2026-10-15T14:00:00-07:00. Leave unknown fields blank. No links or attachments are fetched. Verify the actual submission destination against the buyer’s instructions."
      fields={[
        { name: 'title', label: 'Opportunity title', required: true, max: 200 },
        { name: 'buyer', label: 'Buying agency', required: true, max: 200 },
        { name: 'solicitation_number', label: 'Solicitation number', required: true, max: 200 },
        { name: 'source_url', label: 'Source opportunity URL', required: true, max: 2000 },
        {
          name: 'source_note',
          label: 'Source review reference',
          required: true,
          multiline: true,
          max: 2000,
        },
        { name: 'summary', label: 'Scope summary', multiline: true, max: 6000 },
        { name: 'official_deadline', label: 'Submission deadline with offset', max: 40 },
        {
          name: 'deadline_timezone',
          label: 'Submission display time zone',
          required: true,
          max: 100,
        },
        { name: 'estimated_value', label: 'Estimated value (USD; blank if unknown)', max: 16 },
        ...Object.entries(detailFields).map(([name, label]) => ({
          name,
          label,
          max: 2000,
          multiline: true,
        })),
        ...[
          ['publishedAt', 'Published date'],
          ['questionDeadline', 'Question deadline'],
          ['siteVisit', 'Site visit'],
          ['preBidMeeting', 'Pre-bid meeting'],
        ].map(([name, label]) => ({ name, label: label + ' with offset', max: 40 })),
        { name: 'submissionUrl', label: 'Buyer-designated submission URL', max: 2000 },
        {
          name: 'confirmed',
          label: 'Source review',
          required: true,
          options: [
            { value: '', label: 'Review before saving' },
            {
              value: 'yes',
              label: 'I checked the source, dates, destination and authority to share',
            },
          ],
        },
      ]}
    />
  );
}

export default function SourceRegistry({
  org,
  canEdit,
  admin,
  registrations,
  counts,
  sam,
}: {
  org: string;
  canEdit: boolean;
  admin: boolean;
  registrations: SourceRegistration[];
  counts: Record<string, number>;
  sam: { enabled: boolean; last_status: string; last_success: string | null } | null;
}) {
  const [group, setGroup] = useState<SourceDefinition['group']>('opportunities');
  const [selected, setSelected] = useState('cal-eprocure');
  const list = sourceRegistry.filter((s) => s.group === group);
  const source = list.find((s) => s.id === selected) ?? list[0];
  const registration = registrations.find((r) => r.source_id === source.id);
  const eligible = !source.scheduleRequired || scheduleEligible(registration);
  const savedPortal = reviewedPortalUrl(registration?.portal_url);
  return (
    <section className={`panel ${styles.panel}`}>
      <h1>Source registry</h1>
      <PortalShortcuts />
      <p>
        Independent intake and submission handoffs. No affiliation, endorsement or portal
        partnership is implied. Registration evidence is not an authenticated connector.
      </p>
      <label>
        Source category
        <select
          aria-label="Source category"
          value={group}
          onChange={(e) => setGroup(e.target.value as SourceDefinition['group'])}
        >
          <option value="opportunities">Opportunity sources</option>
          <option value="vehicles">Contract vehicles</option>
          <option value="research">Award and market research</option>
        </select>
      </label>
      <label>
        Source
        <select aria-label="Source" value={source.id} onChange={(e) => setSelected(e.target.value)}>
          {list.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <article key={source.id}>
        <h2>{source.name}</h2>
        <dl>
          <dt>Platform / agency</dt>
          <dd>{source.platform}</dd>
          <dt>Coverage</dt>
          <dd>{source.coverage}</dd>
          <dt>Categories</dt>
          <dd>{source.categories}</dd>
          <dt>Connection type</dt>
          <dd>{connectionLabels[source.mode]}</dd>
          <dt>Connector status</dt>
          <dd>
            {source.id === 'sam.gov'
              ? sam?.enabled
                ? `Enabled; ${sam.last_status}`
                : 'API implemented; not activated for this workspace'
              : 'Manual intake only; automatic connector not connected'}
          </dd>
          <dt>Authentication status</dt>
          <dd>
            {source.id === 'sam.gov' && sam?.enabled
              ? 'Server-managed API configuration; see source inbox status'
              : 'No external account authenticated by BidXchange'}
          </dd>
          <dt>Last successful synchronization</dt>
          <dd>
            {source.id === 'sam.gov'
              ? (sam?.last_success ?? 'None recorded')
              : 'Not applicable — manual handoff'}
          </dd>
          <dt>Sync outcome / errors</dt>
          <dd>
            {source.id === 'sam.gov'
              ? (sam?.last_status ?? 'No synchronization enabled')
              : 'No synchronization attempted'}
          </dd>
          <dt>Active normalized opportunities</dt>
          <dd>{counts[source.id] ?? 0} (legacy unclassified records are separate)</dd>
          <dt>Electronic submission by BidXchange</dt>
          <dd>Not supported. Final human approval and external portal submission required.</dd>
          <dt>Recorded company registration</dt>
          <dd>
            {registration?.registration_status.replaceAll('_', ' ') ?? 'Unknown'}
            {registration?.expires_on ? ` · expires ${registration.expires_on}` : ''}
          </dd>
        </dl>
        {source.url ? (
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            Open {source.platform} portal / guidance ↗
          </a>
        ) : (
          <p>
            Agency-specific destination needs confirmation. Record its reviewed portal URL below; no
            connection is assumed.
          </p>
        )}
        {savedPortal && (
          <p>
            <a href={savedPortal} target="_blank" rel="noopener noreferrer">
              Open company’s reviewed portal ↗
            </a>
            <br />
            <small>
              Destination recorded by your company administrator. Verify the address before signing
              in.
            </small>
          </p>
        )}
        {source.id === 'sam.gov' && (
          <div className="info-note">
            <h3>SAM.gov data connection</h3>
            <p>
              {sam?.enabled
                ? 'The operator has enabled this connector. Check the last successful synchronization above before relying on its freshness.'
                : 'Automatic sync is not active. An operator must privately configure a SAM.gov API key, validate a bounded test, and activate the production job and source inbox.'}
            </p>
            <p>
              Opening SAM.gov does not connect your account. BidXchange never needs your SAM.gov
              password.
            </p>
            <p>
              <a
                href="https://open.gsa.gov/api/get-opportunities-public-api/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Official API key and connection instructions ↗
              </a>
            </p>
            <Link href={`/opportunities/sources?organization=${org}`}>
              SAM.gov source inbox and API status
            </Link>
          </div>
        )}
        {source.group === 'vehicles' && (
          <p>
            Record the awarded vehicle number, expiry and scope evidence. An existing vehicle is not
            an open solicitation or authorization to sell outside its scope.
          </p>
        )}
        {source.group === 'research' && (
          <p>
            Use award history for research. Historical awards are not currently open bids; capture
            relevant references in a pursuit’s incumbent field.
          </p>
        )}
        {admin && (
          <CaptureForm
            key={source.id + ':registration:' + registration?.updated_at}
            label="Update registration evidence"
            action={saveSourceRegistration}
            hidden={{
              organization_id: org,
              source_id: source.id,
              updated_at: registration?.updated_at ?? '',
            }}
            initial={{
              registration_status: registration?.registration_status ?? 'unknown',
              vendor_number: registration?.vendor_number ?? '',
              evidence_reference: registration?.evidence_reference ?? '',
              portal_url: registration?.portal_url ?? '',
              expires_on: registration?.expires_on ?? '',
              schedule_number: registration?.schedule_number ?? '',
            }}
            note="Record reviewed business registration evidence only. Do not enter passwords, tokens, full EINs or banking information. This does not sign in to the portal. For GSA eBuy, record current Schedule number, evidence and expiration before intake."
            fields={[
              {
                name: 'registration_status',
                label: 'Registration status',
                options: ['unknown', 'not_registered', 'in_progress', 'registered', 'expired'].map(
                  (value) => ({ value, label: value.replaceAll('_', ' ') }),
                ),
              },
              {
                name: 'vendor_number',
                label:
                  source.group === 'vehicles'
                    ? 'Awarded vehicle / vendor number'
                    : 'Vendor / supplier number',
                max: 200,
              },
              {
                name: 'evidence_reference',
                label: 'Registration / scope evidence reference',
                multiline: true,
                max: 2000,
              },
              { name: 'portal_url', label: 'Reviewed agency portal URL', max: 2000 },
              {
                name: 'expires_on',
                label: 'Registration or vehicle expiration (YYYY-MM-DD)',
                max: 10,
              },
              { name: 'schedule_number', label: 'GSA Schedule number (when applicable)', max: 200 },
            ]}
          />
        )}
        {!eligible && (
          <p role="status">
            GSA eBuy intake is locked until an administrator records current Schedule eligibility
            evidence, number and expiration. Portal eligibility still requires buyer verification.
          </p>
        )}
        {canEdit && source.group === 'opportunities' && eligible && (
          <SourceOpportunityForm org={org} source={source} />
        )}
      </article>
    </section>
  );
}
