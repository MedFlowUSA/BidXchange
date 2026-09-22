import { createRoot } from 'react-dom/client';
import {
  CreateCompanyForm,
  InviteMemberForm,
  AcceptInvitationForm,
  RevokeInvitationForm,
} from '../../apps/web/components/workspace-onboarding';
import '../../apps/web/app/globals.css';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
createRoot(document.getElementById('root')!).render(
  <main className="auth-page">
    <section className="panel setup-card">
      <h1>Fictional company setup</h1>
      <CreateCompanyForm requestId={id} />
      <h2>Invite a colleague</h2>
      <InviteMemberForm organizationId={id} joinUrl="https://example.test/onboarding" />
      <AcceptInvitationForm
        invitation={{
          id,
          organization_name: 'Fictional Contractor',
          role: 'estimator',
          expires_at: '2026-12-01T00:00:00Z',
        }}
      />
      <RevokeInvitationForm
        organizationId={id}
        invitation={{
          id,
          email: 'colleague@example.test',
          role: 'viewer',
          expires_at: '2026-12-01T00:00:00Z',
          status: 'pending',
        }}
      />
    </section>
  </main>,
);
