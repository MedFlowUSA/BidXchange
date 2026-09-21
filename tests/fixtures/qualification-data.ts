import { workflowData, user } from './workflow-data';
export function qualificationData(role = 'organization_admin') {
  const data = workflowData(role);
  data.evidenceReviewsEnabled = true;
  data.resolutionsEnabled = true;
  data.decisionContext = 'current-context';
  data.facts = [
    {
      id: '66666666-6666-4666-8666-666666666666',
      fact_type: 'license',
      label: 'Synthetic license',
      value: 'Synthetic classification',
      verification_status: 'verified',
      source_reference: 'Synthetic registry',
      source_note: null,
      verified_by: user,
      verified_at: '2026-09-20T00:00:00Z',
      expiration_date: '2026-09-21',
      updated_at: '2026-09-20T00:00:00Z',
      sensitivity: 'workspace',
    },
  ];
  data.requirements![0].requirement = 'License scope';
  data.requirements![0].owner_user_id = user;
  data.requirements!.push({
    ...data.requirements![0],
    id: '77777777-7777-4777-8777-777777777777',
    requirement: 'Insurance coverage',
    status: 'blocked',
  });
  data.evidenceReviews = data.requirements!.map((r) => ({
    id: `review-${r.id}`,
    requirement_id: r.id,
    fact_id: data.facts[0].id,
    applicability: 'applicable',
    proposal_use: 'approved',
    approval_current: true,
    reason: 'Synthetic review',
    reviewed_by: user,
    reviewed_at: '2026-09-20T00:00:00Z',
  }));
  data.resolutions = [
    {
      id: 'resolution',
      requirement_id: data.requirements![0].id,
      disposition: 'supported',
      reason: 'Synthetic finding',
      authority_name: '',
      authority_reference: '',
      reviewed_by: user,
      reviewed_at: '2026-09-20T00:00:00Z',
      review_current: true,
    },
  ];
  data.responsePackages = [
    {
      id: 'draft',
      title: 'RFP response: Synthetic',
      updated_at: data.reviewAsOf,
      status: 'draft',
      content: JSON.stringify({
        schema: 1,
        kind: 'RFP',
        context: data.decisionContext,
        summary: '',
        answers: data.requirements!.map((r) => ({
          requirementId: r.id,
          requirementVersion: r.updated_at,
          text: 'Synthetic answer',
        })),
      }),
    },
  ];
  // The second link is a recorded relationship, not a claim that a license proves insurance.
  return data;
}
