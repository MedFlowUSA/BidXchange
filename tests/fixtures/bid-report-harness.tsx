import { createRoot } from 'react-dom/client';
import BidReportDownload from '../../apps/web/components/bid-report';
import { qualificationData } from './qualification-data';
import { pursuit } from './workflow-data';
import '../../apps/web/app/globals.css';
const data = qualificationData(
  new URLSearchParams(location.search).has('viewer') ? 'viewer' : 'organization_admin',
);
data.responsePackages![0].id = '88888888-8888-4888-8888-888888888888';
createRoot(document.getElementById('root')!).render(
  <main style={{ padding: 16, maxWidth: 1000, margin: 'auto' }}>
    <BidReportDownload data={data} pursuitId={pursuit} />
  </main>,
);
