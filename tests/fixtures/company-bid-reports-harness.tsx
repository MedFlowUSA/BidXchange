import { createRoot } from 'react-dom/client';
import CompanyBidReports from '../../apps/web/components/company-bid-reports';
import { qualificationData } from './qualification-data';
import '../../apps/web/app/globals.css';
const params = new URLSearchParams(location.search);
const data = qualificationData(params.has('viewer') ? 'viewer' : 'organization_admin');
data.pursuits[0].title = 'Fictional lighting bid';
data.pursuits.push({
  ...data.pursuits[0],
  id: '99999999-9999-4999-8999-999999999999',
  title: 'Second fictional bid',
});
if (params.has('empty')) data.pursuits = [];
createRoot(document.getElementById('root')!).render(
  <main style={{ maxWidth: 1000, margin: 'auto', padding: 16 }}>
    <CompanyBidReports data={data} />
  </main>,
);
