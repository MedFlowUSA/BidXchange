import { createRoot } from 'react-dom/client';
import SourceInbox, { type InboxItem } from '../../apps/web/components/source-inbox';
import '../../apps/web/app/globals.css';
const item: InboxItem = {
  id: 'item',
  updated_at: '2026-09-20T00:00:00Z',
  created_at: '2026-09-19T00:00:00Z',
  status: 'new',
  change_pending: true,
  priority: 'critical',
  match_reasons: ['NAICS: 238210'],
  missing_information: ['State'],
  assigned_user_id: null,
  opportunity_id: null,
  record: {
    first_seen: '2026-09-18T00:00:00Z',
    last_seen: '2026-09-18T00:00:00Z',
    current_version_id: 'version',
  },
  versions: [
    {
      id: 'version',
      prior_version_id: 'previous',
      captured_at: '2026-09-18T00:00:00Z',
      changed_fields: ['deadline'],
      severity: 'critical',
      normalized: {
        noticeId: 'test',
        title: 'Synthetic energy notice',
        solicitationNumber: 'ENERGY-1',
        department: 'Synthetic agency',
        subtier: null,
        office: null,
        noticeType: 'Solicitation',
        baseType: null,
        setAside: 'SBA',
        setAsideDescription: null,
        naics: '238210',
        classification: null,
        published: '2026-01-01',
        modified: null,
        deadline: '2026-10-01 12:00',
        deadlineInstant: null,
        status: 'active',
        archiveDate: null,
        place: null,
        officeAddress: null,
        contacts: null,
        descriptionReference: null,
        resources: [],
        award: null,
        sourceUrl: 'https://sam.gov/opp/test/view',
      },
    },
  ],
};
createRoot(document.getElementById('root')!).render(
  <main>
    <h1>Source inbox</h1>
    <SourceInbox
      org="11111111-1111-4111-8111-111111111111"
      items={[item]}
      searches={[]}
      members={[]}
      canEdit={!location.search.includes('viewer')}
      asOf="2026-09-20T00:00:00Z"
    />
  </main>,
);
