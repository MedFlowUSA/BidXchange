import { createRoot } from 'react-dom/client';
import AssistantSamResearch from '../../apps/web/components/assistant-sam-research';
import '../../apps/web/app/globals.css';
createRoot(document.getElementById('root')!).render(
  <main style={{ maxWidth: 1000, padding: 16, margin: 'auto' }}>
    <AssistantSamResearch
      org="11111111-1111-4111-8111-111111111111"
      onClose={() => {}}
      renderSave={(result) => (
        <div role="region" aria-label="Review opportunity">
          {result.title}
        </div>
      )}
    />
  </main>,
);
