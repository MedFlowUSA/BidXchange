import { PLAYBOOK_VERSION, portalPlaybook, safePortalUrl } from '../lib/submission-handoff';
export default function PortalPlaybook({
  portal,
  destination,
  demo = false,
}: {
  portal: string;
  destination?: string;
  demo?: boolean;
}) {
  const book = portalPlaybook(portal);
  const url = destination && safePortalUrl(destination);
  return (
    <section className="portal-playbook" aria-label="Portal playbook">
      <h3>{book.name} · submission playbook</h3>
      <p>
        Checklist version {PLAYBOOK_VERSION}. Check the current notice; buyer instructions govern.
      </p>
      <ol>
        {book.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {book.source && (
        <a href={book.source} target="_blank" rel="noopener noreferrer">
          Official portal information · external site ↗
        </a>
      )}
      {url && !demo && (
        <p>
          <a className="button" href={url} target="_blank" rel="noopener noreferrer">
            Open recorded official portal · external site ↗
          </a>
        </p>
      )}
      {demo && (
        <p>
          This sample has no live buyer destination. The information link opens portal guidance
          only.
        </p>
      )}
    </section>
  );
}
