import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  GettingStarted,
  GuideContent,
  NextActions,
} from '../../apps/web/components/workspace-guide';
import ResponseReleases from '../../apps/web/components/response-release';
import Dialog from '../../apps/web/components/dialog';
import { workflowData, pursuit, release, user } from './workflow-data';
import { checklistLabels, type ReleaseChecklist } from '../../apps/web/lib/response-release';
import '../../apps/web/app/globals.css';
const data = workflowData(new URL(location.href).searchParams.get('role') ?? undefined);
data.releaseWorkflow!.versions = [
  {
    id: release,
    sequence: 1,
    package_id: release,
    package_version: '2026-09-21T00:00:00Z',
    context_token: 'a'.repeat(64),
    checksum: 'b'.repeat(64),
    created_by: user,
    created_at: '2026-09-21T00:00:00Z',
    snapshot: {
      title: 'Synthetic response',
      response: {},
      company: { legal_name: 'Synthetic' },
      opportunity: { deadline: '2026-09-22T00:00:00Z', timezone: 'UTC' },
      requirements: [],
      bid_decision: null,
      checklist: {
        ...Object.fromEntries(
          Object.keys(checklistLabels).map((k) => [
            k,
            { status: 'confirmed', reference: 'Training source' },
          ]),
        ),
        method: 'Training portal',
        portal: 'https://example.com/training',
        source_version: 'Training v1',
        reviewed_at: '2026-09-21T00:00:00Z',
        submitter: user,
        files: [{ name: 'final.pdf', sha256: 'c'.repeat(64), reference: 'Training vault' }],
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
  },
];
function App() {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <button onClick={() => setOpen(true)}>Workspace guide</button>
      <GettingStarted data={data} onOpen={() => setOpen(true)} />
      <NextActions data={data} page="Pursuits" pursuitId={pursuit} />
      <ResponseReleases data={data} pursuitId={pursuit} />
      {open && (
        <Dialog title="Workspace guide" close={() => setOpen(false)}>
          <GuideContent data={data} pursuitId={pursuit} />
        </Dialog>
      )}
    </main>
  );
}
if (new URL(location.href).searchParams.has('submitted')) {
  data.releaseWorkflow!.submissions = [
    {
      id: release,
      release_id: release,
      sequence: 1,
      kind: 'submission',
      previous_id: null,
      submitted_by: user,
      recorded_by: user,
      submitted_at: '2026-09-21T00:00:00Z',
      recorded_at: '2026-09-21T00:00:00Z',
      details: { confirmation: 'Fictional receipt' },
      authorization_id: release,
      checksum: 'b'.repeat(64),
    },
  ];
}
createRoot(document.getElementById('root')!).render(<App />);
