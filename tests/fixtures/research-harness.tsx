import { createRoot } from 'react-dom/client';
import OpportunityResearch from '../../apps/web/components/opportunity-research';
import '../../apps/web/app/globals.css';
import { org } from './workflow-data';
createRoot(document.getElementById('root')!).render(
  <OpportunityResearch org={org} name="Synthetic company" />,
);
