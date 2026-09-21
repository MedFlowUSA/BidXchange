import { createRoot } from 'react-dom/client';
import PublicDemoAssistant from '../../apps/web/components/public-demo-assistant';
import '../../apps/web/app/globals.css';
createRoot(document.getElementById('root')!).render(
  <main>
    <PublicDemoAssistant />
  </main>,
);
