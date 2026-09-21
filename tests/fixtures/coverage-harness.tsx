import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import ResponseCoverage from '../../apps/web/components/response-coverage';
import { newResponseDraft } from '../../apps/web/lib/response-package';
import { workflowData, pursuit } from './workflow-data';
function Harness() {
  const [target, setTarget] = useState('');
  const data = workflowData();
  return (
    <>
      <ResponseCoverage
        data={data}
        pursuitId={pursuit}
        draft={newResponseDraft(data, pursuit)}
        onEdit={setTarget}
      />
      <output>{target}</output>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
