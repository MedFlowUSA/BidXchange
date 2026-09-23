import { createRoot } from 'react-dom/client';
import CompanyPortal, { CompanyPanel } from '../../apps/web/components/company-portal';
import CompanyReview from '../../apps/web/components/company-review';
import { qualificationData } from './qualification-data';
import '../../apps/web/app/globals.css';
const data = qualificationData();
data.facts = [
  {
    ...data.facts[0],
    id: 'example',
    label: 'Website service claim',
    verification_status: 'pending_verification',
    verified_by: null,
    verified_at: null,
  },
];
createRoot(document.getElementById('root')!).render(
  <main style={{ padding: 20, maxWidth: 1100, margin: 'auto' }}>
    <CompanyPortal data={data} reviewCount={2}>
      <CompanyPanel name="overview">
        <CompanyReview data={data} />
        <section className="panel">
          <h2>Profile overview</h2>
          <a href="#fact-example">Review a saved record</a>
        </section>
      </CompanyPanel>
      <CompanyPanel name="edit">
        <section className="panel" id="passport-identity">
          <label>
            Company draft
            <input aria-label="Company draft" />
          </label>
        </section>
      </CompanyPanel>
      <CompanyPanel name="records">
        <section className="panel" id="fact-example">
          <h2>Saved evidence example</h2>
        </section>
      </CompanyPanel>
      <CompanyPanel name="dates">
        <section className="panel">
          <h2>Renewal dates</h2>
        </section>
      </CompanyPanel>
      <CompanyPanel name="requests">
        <section className="panel" id="information-request-example">
          <h2>Requested information</h2>
        </section>
      </CompanyPanel>
    </CompanyPortal>
  </main>,
);
