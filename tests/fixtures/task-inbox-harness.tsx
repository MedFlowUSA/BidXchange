import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import TodayTaskQueue from '../../apps/web/components/today-task-queue';
import { parseTaskInboxFilters } from '../../apps/web/lib/task-inbox';
import { workflowData, pursuit, user } from './workflow-data';
import '../../apps/web/app/globals.css';
const data = workflowData('estimator');
data.tasks = [
  {
    id: 'old-sample',
    title: 'STALE SAMPLE SHOULD NOT APPEAR',
    status: 'todo',
    pursuit_id: pursuit,
  },
];
const params = Object.fromEntries(new URLSearchParams(location.search));
const filters = parseTaskInboxFilters(params, 'estimator').data!;
data.taskInbox = {
  filters,
  asOf: '2026-09-28T12:00:00Z',
  hasNext: filters.page === 0,
  rows: params.empty
    ? []
    : [
        {
          task: {
            id: '55555555-5555-4555-8555-555555555555',
            pursuit_id: pursuit,
            title: filters.page
              ? 'Confirm certified payroll process'
              : 'Request bond letter for the municipal lighting retrofit',
            status: 'in_progress',
            assigned_user_id: filters.owner === 'unassigned' ? null : user,
            due_at: filters.timing === 'undated' ? null : '2026-09-27T12:00:00Z',
            due_timezone: 'America/Los_Angeles',
            priority: 'urgent',
          },
          pursuitTitle: 'Fictional municipal lighting retrofit',
        },
      ],
  error: params.error === 'true',
};
function Harness() {
  const [current, setCurrent] = useState(data);
  return (
    <main>
      <TodayTaskQueue data={current} />
      <button
        onClick={() =>
          setCurrent({
            ...current,
            taskInbox: {
              ...current.taskInbox!,
              filters: { ...current.taskInbox!.filters, page: current.taskInbox!.filters.page + 1 },
            },
          })
        }
      >
        Simulate server page navigation
      </button>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
