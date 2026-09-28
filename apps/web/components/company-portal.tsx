'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Building2,
  FileCheck2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
} from 'lucide-react';
import type { TenantData } from '../lib/tenant-types';
import { companyNextActions } from '../lib/company-next-actions';
import { workspaceHref } from '../lib/routes';
import styles from './company-portal.module.css';

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'edit', label: 'Edit profile', icon: Building2 },
  { id: 'review', label: 'Review queue', icon: ListChecks },
  { id: 'records', label: 'Saved records', icon: FileCheck2 },
  { id: 'reports', label: 'Bid reports', icon: FileCheck2 },
  { id: 'dates', label: 'Radar', icon: CalendarDays },
  { id: 'requests', label: 'Requests', icon: ClipboardList },
  { id: 'decisions', label: 'Decision Log', icon: ClipboardList },
] as const;
type Section = (typeof sections)[number]['id'];
const ActiveSection = createContext<Section>('overview');
export function companySection(hash: string, decisionsEnabled = true): Section {
  if (hash === '#company-review') return 'review';
  if (hash === '#company-reports') return 'reports';
  if (hash === '#company-decisions') return decisionsEnabled ? 'decisions' : 'overview';
  if (hash.startsWith('#passport-') || hash === '#company-edit') return 'edit';
  if (hash.startsWith('#fact-') || hash === '#company-readiness' || hash === '#company-records')
    return 'records';
  if (
    hash.startsWith('#information-request-') ||
    hash === '#company-onboarding' ||
    hash === '#company-requests'
  )
    return 'requests';
  if (hash === '#company-dates') return 'dates';
  return 'overview';
}
export default function CompanyPortal({
  data,
  children,
  reviewCount,
}: {
  data: TenantData;
  children: ReactNode;
  reviewCount: number;
}) {
  const [active, setActive] = useState<Section>('overview');
  const [fragment, setFragment] = useState('');
  const portal = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sync = () => {
      setActive(companySection(location.hash, !!data.decisionMemoryEnabled));
      setFragment(location.hash);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [data.decisionMemoryEnabled]);
  useEffect(() => {
    if (!fragment) return;
    // The fragment target was hidden when native anchor navigation ran. Wait for panels,
    // Passport questions and fact disclosures to render before moving focus and scrolling.
    const frame = requestAnimationFrame(() => {
      let id: string;
      try {
        id = decodeURIComponent(fragment.slice(1));
      } catch {
        id = `company-${active}`;
      }
      const destination = document.getElementById(id);
      const target =
        destination && portal.current?.contains(destination) && destination.getClientRects().length
          ? destination
          : document.getElementById(`company-${active}`);
      if (!target || !portal.current?.contains(target)) return;
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, fragment]);
  const { requests, progress, renewalCount } = companyNextActions(data);
  const admin = data.organization.role === 'organization_admin';
  return (
    <ActiveSection.Provider value={active}>
      <div className={styles.portal} ref={portal}>
        <header className={styles.hero}>
          <div className={styles.identity}>
            <span className={styles.avatar} aria-hidden="true">
              <Building2 size={28} />
            </span>
            <div>
              <span className={styles.eyebrow}>COMPANY PROFILE</span>
              <h1>{data.organization.operating_name}</h1>
              {data.organization.legal_name !== data.organization.operating_name && (
                <p>{data.organization.legal_name}</p>
              )}
            </div>
          </div>
          <p className={styles.intro}>
            Your company details, services and contracting records. Keep the Passport evidence
            current for each bid.
          </p>
          <div className={styles.setupProgress}>
            <div>
              <strong>{progress.percent}%</strong>
              <span> of {admin ? 'profile' : 'visible profile'} fields recorded</span>
              <p>
                {progress.completed} of {progress.total} Level-1 fields. Evidence review is
                separate.
              </p>
            </div>
            <div>
              <progress
                aria-label="Company profile fields recorded"
                max={progress.total}
                value={progress.completed}
              />
              <a href="#profile-completion-title">See missing fields →</a>
            </div>
          </div>
          {!admin && (
            <p className={styles.scopeNote}>
              Your role may hide records. These counts describe your visible records only.
            </p>
          )}
          {data.facts.length >= 500 && (
            <p className={styles.scopeNote}>
              This view is limited to 500 records; additional saved evidence may be omitted.
            </p>
          )}
          <div className={styles.quickLinks}>
            <a href="#company-edit" className={styles.profileAction}>
              <Building2 size={20} aria-hidden="true" />
              <span>
                {data.organization.role === 'organization_admin'
                  ? 'Edit company profile'
                  : 'View profile fields'}
              </span>
              <span aria-hidden="true">→</span>
            </a>
            <a href="#company-review">
              <strong>{reviewCount}</strong>
              <span>Records to review</span>
              <span aria-hidden="true">→</span>
            </a>
            <a href="#company-requests">
              <strong>{requests.length}</strong>
              <span>Open information requests</span>
              <span aria-hidden="true">→</span>
            </a>
            <a href="#company-dates">
              <strong>{renewalCount}</strong>
              <span>Check dates & renewals</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </header>
        <nav className={styles.navigation} aria-label="Company sections">
          {sections
            .filter((s) => s.id !== 'decisions' || data.decisionMemoryEnabled)
            .map(({ id, label, icon: Icon }) => (
              <a key={id} href={`#company-${id}`} aria-current={active === id ? 'page' : undefined}>
                <Icon size={17} aria-hidden="true" />
                {label}
              </a>
            ))}
        </nav>
        {children}
      </div>
    </ActiveSection.Provider>
  );
}
export function CompanyNextActions({ data }: { data: TenantData }) {
  const { actions } = companyNextActions(data);
  const capture = ['organization_admin', 'capture_manager'].includes(data.organization.role);
  return (
    <section className={styles.nextActions} aria-labelledby="company-next-actions-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>START HERE</span>
          <h2 id="company-next-actions-title">Your next actions</h2>
        </div>
        <a href="#company-review">Open the review queue →</a>
      </div>
      <p>Follow up on dates and requests first, then complete and review your company records.</p>
      {actions.length ? (
        <ol className={styles.actionList}>
          {actions.map((action) => (
            <li key={action.id}>
              <span className={styles.actionLabel}>{action.label}</span>
              <a href={action.href}>
                {action.title} <span aria-hidden="true">→</span>
              </a>
              <p>{action.detail}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          No follow-ups are flagged in the visible records. Check the requirements of your next bid
          before reusing evidence.
        </p>
      )}
      <div className={styles.bidLinks}>
        <div>
          <strong>Ready to work on a bid?</strong>
          <p>
            Open an existing pursuit or bring in the buyer’s notice. Profile completion is not a
            gate to starting a review.
          </p>
        </div>
        <Link href={workspaceHref('/pursuits', data.organization.id)}>Open pursuits →</Link>
        <a href="#company-reports">Generate a bid report →</a>
        <Link href={workspaceHref('/opportunities', data.organization.id)}>
          {capture ? 'Add or review a notice →' : 'View opportunities →'}
        </Link>
      </div>
    </section>
  );
}
export function CompanyPanel({ name, children }: { name: Section; children: ReactNode }) {
  const active = useContext(ActiveSection);
  return (
    <div id={`company-${name}`} className={styles.section} hidden={active !== name}>
      {children}
    </div>
  );
}
