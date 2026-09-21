import { createRoot } from 'react-dom/client';
import SourceRegistry from '../../apps/web/components/source-registry';
import '../../apps/web/app/globals.css';
import { org } from './workflow-data';
const viewer = new URL(location.href).searchParams.get('role') === 'viewer';
createRoot(document.getElementById('root')!).render(
  <main>
    <SourceRegistry
      org={org}
      canEdit={!viewer}
      admin={!viewer}
      registrations={[]}
      counts={{ 'cal-eprocure': 2 }}
      sam={null}
    />
  </main>,
);
