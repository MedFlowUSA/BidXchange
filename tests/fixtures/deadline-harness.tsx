import { createRoot } from 'react-dom/client';
import { CaptureForm, OpportunityForm, TaskForm } from '../../apps/web/components/capture-forms';
import { SourceOpportunityForm } from '../../apps/web/components/source-registry';
import { PepmaIntake } from '../../apps/web/components/pepma-workflow';
import ResponseReleases from '../../apps/web/components/response-release';
import TaskContext from '../../apps/web/components/task-context';
import { sourceRegistry } from '../../apps/web/lib/sources/registry';
import { workflowData, pursuit } from './workflow-data';
import { handoffFixture } from './handoff-data';
import '../../apps/web/app/globals.css';
const data = workflowData();
data.organization.default_timezone = 'America/Los_Angeles';
data.releaseWorkflow!.versions = [handoffFixture()];
data.responsePackages = [
  {
    id: handoffFixture().package_id,
    title: 'Fictional draft',
    content: null,
    updated_at: '2026-09-26T12:00:00Z',
    status: 'draft',
  },
];
data.opportunities[0].deadline_timezone = 'America/Los_Angeles';
data.opportunities[0].official_deadline = '2026-11-01T09:30:12.123456+00:00';
createRoot(document.getElementById('root')!).render(
  <main>
    <OpportunityForm data={data} />
    <OpportunityForm data={data} opportunity={data.opportunities[0]} />
    <TaskForm data={data} pursuitId={pursuit} />
    <SourceOpportunityForm
      org={data.organization.id}
      source={sourceRegistry.find((s) => s.id === 'cal-eprocure')!}
    />
    <PepmaIntake data={data} />
    <ResponseReleases data={data} pursuitId={pursuit} />
    <section aria-label="Assigned task instructions">
      <TaskContext
        data={{ ...data, organization: { ...data.organization, role: 'viewer' } }}
        task={{
          id: 'task',
          pursuit_id: pursuit,
          title: 'Check bond',
          status: 'todo',
          priority: 'urgent',
          notes:
            'Request the letter from the surety.\nUse notice section 4.2. <script>not code</script>',
          requirement_id: data.requirements![0].id,
        }}
      />
      <TaskContext
        data={data}
        task={{
          id: 'foreign-task',
          pursuit_id: 'different',
          title: 'Do not borrow another pursuit',
          status: 'todo',
          requirement_id: data.requirements![0].id,
        }}
      />
    </section>
    <CaptureForm
      label="Retry test"
      action={async (_state, form) => ({ message: 'Synthetic save failed: ' + form.get('date') })}
      hidden={{}}
      initial={{ date: '', zone: 'America/Los_Angeles' }}
      note="Fictional test"
      fields={[
        { name: 'zone', label: 'Retry zone' },
        { name: 'date', label: 'Retry deadline', dateTimeZone: { field: 'zone' } },
      ]}
    />
  </main>,
);
