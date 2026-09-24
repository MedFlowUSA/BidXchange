import { createRoot } from 'react-dom/client';
import CompanyPortal, { CompanyPanel } from '../../apps/web/components/company-portal';
import CompanyReview from '../../apps/web/components/company-review';
import CompanySnapshot from '../../apps/web/components/company-snapshot';
import ProfileCompletion from '../../apps/web/components/profile-completion';
import { qualificationData } from './qualification-data';
import '../../apps/web/app/globals.css';
const data = qualificationData();
const params = new URLSearchParams(location.search);
if (params.has('viewer')) data.organization.role = 'viewer';
data.facts = [
  {
    ...data.facts[0],
    id: 'example',
    label: 'Website service claim',
    fact_type: 'capability',
    value: 'Lighting retrofits and electrical upgrades for public facilities.',
    verification_status: 'pending_verification',
    verified_by: null,
    verified_at: null,
  },
];
if (params.has('empty')) data.facts = [];
createRoot(document.getElementById('root')!).render(
  <main style={{ padding: 20, maxWidth: 1100, margin: 'auto' }}>
    <CompanyPortal data={data} reviewCount={data.facts.length}>
      <CompanyPanel name="overview">
        <CompanySnapshot data={data} />
        <ProfileCompletion data={data} />
      </CompanyPanel>
      <CompanyPanel name="review">
        <CompanyReview data={data} />
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
