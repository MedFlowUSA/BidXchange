'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  Building2,
  FileCheck2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
} from 'lucide-react';
import type { TenantData } from '../lib/tenant-types';
import { informationRequestQueue } from '../lib/information-requests';
import styles from './company-portal.module.css';

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'edit', label: 'Edit profile', icon: Building2 },
  { id: 'review', label: 'Review queue', icon: ListChecks },
  { id: 'records', label: 'Saved records', icon: FileCheck2 },
  { id: 'dates', label: 'Radar', icon: CalendarDays },
  { id: 'requests', label: 'Requests', icon: ClipboardList },
  { id: 'decisions', label: 'Decision Log', icon: ClipboardList },
] as const;
type Section = (typeof sections)[number]['id'];
const ActiveSection = createContext<Section>('overview');
export function companySection(hash: string): Section {
  if (hash === '#company-review') return 'review';
  if (hash === '#company-decisions') return 'decisions';
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
  useEffect(() => {
    const sync = () => setActive(companySection(location.hash));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const requests = informationRequestQueue(data).filter((r) => r.status !== 'complete');
  return (
    <ActiveSection.Provider value={active}>
      <div className={styles.portal}>
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
              <CalendarDays size={20} aria-hidden="true" />
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
export function CompanyPanel({ name, children }: { name: Section; children: ReactNode }) {
  const active = useContext(ActiveSection);
  return (
    <div id={`company-${name}`} className={styles.section} hidden={active !== name}>
      {children}
    </div>
  );
}
