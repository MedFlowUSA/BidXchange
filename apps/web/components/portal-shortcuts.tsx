import { sourceRegistry } from '../lib/sources/registry';
import styles from './portal-shortcuts.module.css';

const featured = [
  'sam.gov',
  'pepma',
  'cal-eprocure',
  'sb-epro',
  'sce-ariba',
  'ladwp',
  'rampla',
  'lausd-ariba',
  'lausd-facilities',
];
export default function PortalShortcuts() {
  return (
    <section className={styles.portals} aria-labelledby="portal-shortcuts-title">
      <h2 id="portal-shortcuts-title">Open a procurement portal</h2>
      <p>
        Search notices or sign in directly with the platform. Each link opens a new tab; data
        synchronization is configured separately.
      </p>
      <div className={styles.grid}>
        {featured.map((id) => {
          const source = sourceRegistry.find((s) => s.id === id)!;
          return (
            <a key={id} href={source.url!} target="_blank" rel="noopener noreferrer">
              <strong>{source.platform === 'SAM.gov' ? 'SAM.gov' : source.name}</strong>
              <span>{source.coverage} · External site ↗</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
