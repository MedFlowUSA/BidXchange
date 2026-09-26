import {
  checklistLabels,
  type ResponseRelease,
  type ReleaseChecklist,
} from '../../apps/web/lib/response-release';
import { EXTERNAL_COMPLETION } from '../../apps/web/lib/submission-handoff';
import { org, user, release } from './workflow-data';
export function handoffFixture() {
  const row: ResponseRelease & { organization_id: string } = {
    organization_id: org,
    id: release,
    sequence: 2,
    package_id: release,
    package_version: '2026-09-26T12:00:00Z',
    context_token: 'a'.repeat(64),
    checksum: 'b'.repeat(64),
    created_by: user,
    created_at: '2026-09-26T12:00:00Z',
    snapshot: {
      title: 'Fictional lighting retrofit',
      response: { privateTest: 'DO NOT INCLUDE RAW RESPONSE' },
      company: { legal_name: 'Fictional Apex Energy' },
      opportunity: {
        buyer: 'Fictional city',
        solicitation: 'SAMPLE-001',
        deadline: '2026-10-08T14:00:00-07:00',
        timezone: 'America/Los_Angeles',
        source_url: 'https://example.com/notice',
      },
      requirements: [
        {
          id: release,
          text: 'Bring proof of active DIR registration.',
          citation: 'Fictional section 2',
          owner: user,
          finding: 'reviewed_ok',
          review_current: true,
        },
      ],
      bid_decision: null,
      checklist: {
        ...Object.fromEntries(
          Object.keys(checklistLabels).map((k) => [
            k,
            {
              status: 'confirmed',
              reference: `Fictional review${['pricing', 'signatures', 'certifications'].includes(k) ? `\n${EXTERNAL_COMPLETION}` : ''}`,
            },
          ]),
        ),
        method: 'PlanetBids',
        portal: 'https://example.com/notice',
        source_version: 'Addendum 2',
        reviewed_at: '2026-09-26T12:00:00Z',
        submitter: user,
        files: [
          {
            name: 'response.pdf',
            sha256: 'c'.repeat(64),
            reference: 'Company secure folder / reviewed response',
          },
        ],
      } as ReleaseChecklist,
    },
    status: {
      state: 'Authorized for submission',
      current: true,
      blockers: [],
      approvals: { pricing: true, compliance: true, final: true, submission: true },
      approval_ids: {},
      checksum: 'b'.repeat(64),
      submission_id: null,
    },
  };
  return row;
}
