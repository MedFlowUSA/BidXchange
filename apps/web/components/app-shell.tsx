'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Bell,
  Building2,
  BookOpen,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { sections, workspaceHref, type OrganizationChoice, type SearchRecord } from '../lib/routes';
import { signOut } from '../app/login/actions';
import Dialog from './dialog';
import Assistant from './assistant';
import PublicDemoAssistant from './public-demo-assistant';

const icons = {
  Assistant: Sparkles,
  Today: LayoutDashboard,
  Opportunities: Search,
  Pursuits: Target,
  Company: Building2,
  Reports: TrendingUp,
  Settings,
};
export default function AppShell({
  page,
  organization,
  choices = [],
  userEmail,
  records = [],
  onHelp,
  onNotifications,
  assistant,
  badges,
  children,
}: {
  page: string;
  organization?: OrganizationChoice;
  choices?: OrganizationChoice[];
  userEmail?: string;
  records?: SearchRecord[];
  onHelp?: () => void;
  onNotifications?: () => void;
  assistant?: React.ReactNode;
  badges?: { pursuit: number; passport: number };
  children: React.ReactNode;
}) {
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [switcher, setSwitcher] = useState(false);
  const [buddyOpen, setBuddyOpen] = useState(page === 'Assistant');
  const buddy =
    assistant ??
    (organization ? (
      <Assistant organizationId={organization.id} name={organization.operating_name} expanded />
    ) : (
      <PublicDemoAssistant />
    ));
  useEffect(() => {
    const reveal = () => {
      if (location.hash === '#bid-assistant') setBuddyOpen(true);
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, []);
  const navigation = ['Pursuits', 'Company', 'Opportunities', 'Today'];
  const displayLabel = (label: string) =>
    label === 'Company'
      ? 'Passport'
      : label === 'Opportunities'
        ? 'All bids'
        : label === 'Pursuits' && !organization
          ? 'This bid'
          : label;
  const navHref = (label: string) =>
    workspaceHref(
      label === 'Pursuits' && !organization ? '/pursuits/DEMO-001' : sections[label],
      organization?.id,
    ) + (label === 'Today' && !organization ? '&view=today' : '');
  const name = organization?.operating_name ?? 'Apex Energy Demo';
  const results = query.trim()
    ? records
        .filter((r) =>
          `${r.title} ${r.text ?? ''} ${r.category}`.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 30)
    : [];
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'visible' : ''}`}>
        <Link href={workspaceHref('/dashboard', organization?.id)} className="brand">
          <img src="/brand/bidxchange-icon.png?v=2" alt="" />
          <span>
            Bid<span className="gold">X</span>change
          </span>
        </Link>
        <div className="workspace-label">CONTRACT DESK</div>
        <button
          className="workspace-selector"
          aria-label="Switch workspace"
          onClick={() => {
            setMobile(false);
            setSwitcher(true);
          }}
        >
          <span className="company-avatar">
            {name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join('')
              .toUpperCase()}
          </span>
          <span>
            <b>{name}</b>
            <small>{organization ? 'Authenticated workspace' : 'Fictional demonstration'}</small>
          </span>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((label) => {
            const Icon = icons[label as keyof typeof icons];
            const count =
              label === 'Pursuits' ? badges?.pursuit : label === 'Company' ? badges?.passport : 0;
            return (
              <Link
                href={navHref(label)}
                className={`nav-item ${page === label ? 'active' : ''}`}
                aria-current={page === label ? 'page' : undefined}
                onClick={() => setMobile(false)}
                key={label}
              >
                <Icon size={19} />
                <span>{displayLabel(label)}</span>
                {!!count && (
                  <span className="nav-count" aria-label={`${count} items need attention`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <details className="secondary-navigation" open={page === 'Reports'}>
          <summary className="nav-item">More</summary>
          <nav aria-label="More navigation">
            {organization && (
              <Link
                href={workspaceHref('/opportunities/registry', organization.id)}
                className="nav-item"
                onClick={() => setMobile(false)}
              >
                Portals & connections
              </Link>
            )}
            <Link
              href={workspaceHref('/reports', organization?.id)}
              className={`nav-item ${page === 'Reports' ? 'active' : ''}`}
              aria-current={page === 'Reports' ? 'page' : undefined}
              onClick={() => setMobile(false)}
            >
              <TrendingUp size={19} />
              Reports
            </Link>
          </nav>
        </details>
        <div className="sidebar-bottom">
          <a
            href="/guides/bidxchange-user-guide.pdf"
            className="nav-item"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="How-to guide (PDF, opens in a new tab)"
            onClick={() => setMobile(false)}
          >
            <BookOpen size={19} />
            <span>How-to guide (PDF)</span>
          </a>
          {onHelp && (
            <button className="nav-item help" onClick={onHelp}>
              <CircleHelp size={19} />
              Workspace guide
            </button>
          )}
          {userEmail && (
            <div className="profile">
              <span className="profile-avatar">
                {userEmail ? userEmail.slice(0, 2).toUpperCase() : 'DM'}
              </span>
              <div>
                <b>{userEmail ? 'Signed in' : 'Demo member'}</b>
                <small>{organization?.role.replaceAll('_', ' ') ?? 'Preview access'}</small>
              </div>
            </div>
          )}
          {userEmail && (
            <details className="secondary-navigation" open={page === 'Settings'}>
              <summary className="nav-item">Account and organization</summary>
              <Link
                className={`nav-item ${page === 'Settings' ? 'active' : ''}`}
                href={workspaceHref('/settings', organization?.id)}
                onClick={() => setMobile(false)}
              >
                <Settings size={19} />
                Settings
              </Link>
            </details>
          )}
          {userEmail ? (
            <form action={signOut}>
              <button className="nav-item">Sign out</button>
            </form>
          ) : (
            <Link className="nav-item" href="/login">
              Sign in to your workspace →
            </Link>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="active-workspace">{name}</span>
            <ChevronRight size={14} />
            <b>{page === 'Assistant' ? 'BidBuddy' : displayLabel(page)}</b>
          </div>
          <div className="topbar-right">
            <button
              className="button buddy-trigger"
              aria-haspopup="dialog"
              onClick={() => setBuddyOpen(true)}
            >
              <Sparkles size={17} />
              BidBuddy
            </button>
            <button
              className="icon-button"
              aria-label="Global search"
              onClick={() => setSearch(true)}
            >
              <Search size={19} />
            </button>
            {onNotifications && (
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                onClick={onNotifications}
              >
                <Bell size={19} />
                <i />
              </button>
            )}
          </div>
        </header>
        <p className="human-review-notice">
          Human review required. BidXchange organizes contracting information but does not determine
          legal eligibility, set pricing, or submit bids.
        </p>
        {children}
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {navigation.map((label) => {
          const Icon = icons[label as keyof typeof icons];
          const count =
            label === 'Pursuits' ? badges?.pursuit : label === 'Company' ? badges?.passport : 0;
          return (
            <Link
              key={label}
              href={navHref(label)}
              aria-current={page === label ? 'page' : undefined}
            >
              <Icon size={20} />
              {displayLabel(label)}
              {!!count && (
                <span className="mobile-nav-count" aria-label={`${count} items need attention`}>
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <button className="buddy-fab" aria-label="Open BidBuddy" onClick={() => setBuddyOpen(true)}>
        <Sparkles size={20} />
        BidBuddy
      </button>
      {buddyOpen && (
        <Dialog title="BidBuddy" close={() => setBuddyOpen(false)} drawer>
          {buddy}
        </Dialog>
      )}
      {switcher && (
        <Dialog title="Switch workspace" close={() => setSwitcher(false)}>
          <div className="workspace-options">
            <Link href={workspaceHref('/dashboard')} onClick={() => setSwitcher(false)}>
              <b>Apex Energy Demo</b>
              <small>Fictional · browser-local data</small>
            </Link>
            {choices.map((org) => (
              <Link
                href={workspaceHref('/dashboard', org.id)}
                key={org.id}
                onClick={() => setSwitcher(false)}
              >
                <b>{org.operating_name}</b>
                <small>{org.role.replaceAll('_', ' ')} · authenticated data</small>
              </Link>
            ))}
            {!userEmail && <Link href="/login">Sign in to access your organization →</Link>}
            {userEmail && choices.length === 0 && (
              <p>No active organization membership. Ask your administrator to assign access.</p>
            )}
          </div>
        </Dialog>
      )}
      {search && (
        <Dialog title="Search this workspace" close={() => setSearch(false)}>
          <div className="global-search">
            <label className="search-field">
              <Search size={18} />
              <input
                autoFocus
                aria-label="Global search query"
                placeholder="Title, buyer, solicitation, document, fact…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <p>
              Searches loaded workspace records only (up to 500 per category). Document contents and
              live procurement sources are not indexed.
            </p>
            {results.map((r, i) => (
              <Link key={`${r.href}-${i}`} href={r.href} onClick={() => setSearch(false)}>
                <b>{r.title}</b>
                <small>{r.category}</small>
              </Link>
            ))}
            {query && !results.length && <p>No matching records in this workspace.</p>}
          </div>
        </Dialog>
      )}
    </div>
  );
}
