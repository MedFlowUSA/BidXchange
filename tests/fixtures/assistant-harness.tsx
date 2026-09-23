import { createRoot } from 'react-dom/client';
import Assistant from '../../apps/web/components/assistant';
import '../../apps/web/app/globals.css';
createRoot(document.getElementById('root')!).render(
  <Assistant
    organizationId="11111111-1111-4111-8111-111111111111"
    name="Synthetic Test Company"
    expanded
  />,
);
