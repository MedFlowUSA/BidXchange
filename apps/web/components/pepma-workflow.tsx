'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CaptureForm, TaskForm, RequirementForm } from './capture-forms';
import { savePepmaOpportunity } from '../app/pepma-actions';
import { pepmaHome, pepmaChecks } from '../lib/pepma';
import type { TenantData } from '../lib/tenant-types';
import { workspaceHref } from '../lib/routes';
import styles from './pepma-workflow.module.css';

export function PepmaIntake({ data }: { data: TenantData }) {
  return (
    <section id="pepma-intake" className={`panel ${styles.panel}`} aria-label="PEPMA bid intake">
      <h2>Bring a PEPMA invitation into your workspace</h2>
      <p>
        Record an invitation you are authorized to access. Public listings may omit invited bids.
        This does not connect your PEPMA login or fetch bid documents.
      </p>
      <a href={pepmaHome} target="_blank" rel="noopener noreferrer">
        Open PEPMA
      </a>
      <CaptureForm
        label="Record PEPMA bid"
        action={savePepmaOpportunity}
        hidden={{ organization_id: data.organization.id }}
        initial={{ source_url: pepmaHome, buyer: '', bid_category: '', confirmed: '' }}
        note="All workspace members can read these details. Do not paste credentials or confidential source documents. Enter dates with an explicit offset (for example 2026-10-15T14:00:00-07:00); display uses America/Los_Angeles. Leave unknown dates blank. Source details are saved as an editable, audited source note."
        fields={[
          { name: 'title', label: 'PEPMA bid name', required: true, max: 200 },
          { name: 'solicitation_number', label: 'PEPMA bid number', required: true, max: 200 },
          {
            name: 'buyer',
            label: 'Sponsoring utility',
            required: true,
            options: [
              { value: '', label: 'Choose utility' },
              ...['SCE', 'SoCalGas', 'PG&E', 'SDG&E', 'Joint IOU'].map((value) => ({
                value,
                label: value,
              })),
            ],
          },
          {
            name: 'bid_category',
            label: 'PEPMA bid category',
            required: true,
            options: [
              { value: '', label: 'Choose category' },
              ...['Professional services', 'Third-party program', 'Other / confirm with buyer'].map(
                (value) => ({ value, label: value }),
              ),
            ],
          },
          { name: 'service_area', label: 'IOU service area', required: true, max: 200 },
          { name: 'bid_manager', label: 'Bid manager / business contact', max: 200 },
          { name: 'source_url', label: 'PEPMA bid page URL', required: true, max: 2000 },
          {
            name: 'source_note',
            label: 'Invitation / source reference',
            required: true,
            max: 700,
            multiline: true,
          },
          { name: 'summary', label: 'Program scope summary', max: 6000, multiline: true },
          { name: 'question_deadline', label: 'Questions deadline with offset', max: 40 },
          { name: 'official_deadline', label: 'Proposal deadline with offset', max: 40 },
          { name: 'latest_update', label: 'Latest addendum / Q&A reference', max: 200 },
          {
            name: 'confirmed',
            label: 'Source and sharing review',
            required: true,
            options: [
              { value: '', label: 'Review before saving' },
              {
                value: 'yes',
                label: 'I checked the source and may share these details in this workspace',
              },
            ],
          },
        ]}
      />
    </section>
  );
}

export function PepmaWorkflow({
  data,
  pursuitId,
  canEdit,
}: {
  data: TenantData;
  pursuitId: string;
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <section className={`panel ${styles.panel}`} aria-label="PEPMA pursuit workflow">
      <h2>PEPMA bid desk</h2>
      <p>
        Manual review checklist. These prompts are not confirmed requirements or a completed portal
        check. The specific invitation and RFx control.
      </p>
      <nav aria-label="PEPMA workflow links">
        <a href={pepmaHome} target="_blank" rel="noopener noreferrer">
          Check PEPMA
        </a>
        {' · '}
        <Link href={workspaceHref('/company', data.organization.id)}>Company evidence</Link>
        {' · '}
        <a href="#pursuit-requirements">Requirements and amendments</a>
        {' · '}
        <a href="#response-packages">Prepare responses</a>
        {' · '}
        {data.releaseWorkflow?.enabled && (
          <a href="#response-release">Review files and record submission</a>
        )}
      </nav>
      {pepmaChecks.map((item, index) => (
        <article key={item.title}>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
          {canEdit && (
            <button type="button" className="button secondary" onClick={() => setSelected(index)}>
              Plan follow-up: {item.title}
            </button>
          )}
        </article>
      ))}
      {canEdit && selected !== null && (
        <div key={selected}>
          <h3>Assign this review</h3>
          <TaskForm
            data={data}
            pursuitId={pursuitId}
            suggestedTitle={`PEPMA: ${pepmaChecks[selected].title}`}
          />
          <p>
            For a requirement, enter the buyer’s actual wording and exact citation below. For
            changes to an existing requirement, use its amendment control in the register.
          </p>
          <RequirementForm data={data} pursuitId={pursuitId} />
        </div>
      )}
    </section>
  );
}
