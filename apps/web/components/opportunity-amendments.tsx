import type { TenantData } from '../lib/tenant-types';
import { CaptureForm } from './capture-forms';
import { recordAmendment, reviewAmendment } from '../app/amendment-actions';
import AmendmentComparison from './amendment-comparison';
export default function OpportunityAmendments({
  data,
  pursuitId,
}: {
  data: TenantData;
  pursuitId: string;
}) {
  const pursuit = data.pursuits.find((p) => p.id === pursuitId);
  if (!pursuit || !data.contractorWorkflowEnabled) return null;
  return (
    <section className="panel" id="opportunity-amendments">
      <h2>Opportunity amendments</h2>
      <AmendmentComparison data={data} opportunityId={pursuit.opportunity_id} />
      <p>
        Record the official change before updating the register. Each amendment requires another
        review of requirements and the bid decision.
      </p>
      {!data.amendments?.length && (
        <p>
          No amendments recorded. Check the official portal; this is not confirmation that none
          exist.
        </p>
      )}
      {data.amendments?.map((a) => (
        <div key={a.id}>
          <h3>{a.label}</h3>
          <p>{a.summary}</p>
          <p>
            {a.issued_on || 'Issue date unknown'} ·{' '}
            {a.reviewed ? 'Review recorded' : 'Needs human review'}
          </p>
          <a href={a.source_url} target="_blank" rel="noopener noreferrer">
            Official source · external site
          </a>
          {a.reviewed_at && (
            <p>
              Review recorded at {a.reviewed_at} by{' '}
              {a.reviewed_by === data.userId ? 'you' : a.reviewed_by}.
            </p>
          )}
          {!a.reviewed &&
            ['organization_admin', 'capture_manager'].includes(data.organization.role) && (
              <CaptureForm
                label="Record human amendment review"
                action={reviewAmendment}
                hidden={{
                  organization_id: data.organization.id,
                  amendment_id: a.id,
                  updated_at: a.updated_at,
                }}
                initial={{ acknowledgment: '' }}
                fields={[
                  {
                    name: 'acknowledgment',
                    label: 'Type reviewed after reading the official change',
                    required: true,
                    max: 8,
                  },
                ]}
                note="This records your review of the amendment. Requirements and the final decision still need separate human review."
              />
            )}
        </div>
      ))}
      {['organization_admin', 'capture_manager'].includes(data.organization.role) && (
        <CaptureForm
          label="Record amendment"
          action={recordAmendment}
          hidden={{ organization_id: data.organization.id, opportunity_id: pursuit.opportunity_id }}
          initial={{ label: '', issued_on: '', source_url: '', summary: '', notice_text: '' }}
          note="Use public notice text or a source note. Previous sign-off and decision history are preserved, but must be reviewed again."
          fields={[
            { name: 'label', label: 'Amendment number or label', required: true, max: 200 },
            { name: 'issued_on', label: 'Issue date (YYYY-MM-DD)', max: 10 },
            { name: 'source_url', label: 'Official amendment URL', required: true, max: 2000 },
            {
              name: 'summary',
              label: 'Amendment summary',
              required: true,
              max: 4000,
              multiline: true,
            },
            {
              name: 'notice_text',
              label: 'Public amendment excerpt or note',
              max: 24000,
              multiline: true,
            },
          ]}
        />
      )}
    </section>
  );
}
