import { createRoot } from 'react-dom/client';
import EvidenceReminders from '../../apps/web/components/evidence-reminders';
import { qualificationData } from './qualification-data';
import '../../apps/web/app/globals.css';
const data = qualificationData();
data.reviewAsOf = '2026-09-22T12:00:00Z';
data.evidenceMonitoring = {
  unavailable: false,
  status: {
    last_success_at: '2026-09-22T00:00:00Z',
    last_attempt_at: '2026-09-22T00:00:00Z',
    failed: false,
  },
  reminders: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      fact_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      kind: 'expired',
      assigned_user_id: data.userId,
      acknowledged_at: null,
      updated_at: '2026-09-22T00:00:00Z',
      source: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        label: 'Fictional license',
        expiration_date: '2026-09-21',
      },
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      fact_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      kind: '30',
      assigned_user_id: null,
      acknowledged_at: null,
      updated_at: '2026-09-22T00:00:00Z',
      source: {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        label: 'Fictional registration',
        expiration_date: '2026-10-10',
      },
    },
  ],
};
createRoot(document.getElementById('root')!).render(
  <main>
    <EvidenceReminders data={data} />
  </main>,
);
