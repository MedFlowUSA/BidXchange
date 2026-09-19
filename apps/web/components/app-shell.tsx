'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Bell,
  Building2,
  ChevronRight,
  CircleHelp,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { sections, workspaceHref, type OrganizationChoice, type SearchRecord } from '../lib/routes';
import { signOut } from '../app/login/actions';
import Dialog from './dialog';

const icons = {
  Assistant: Sparkles,
  Today: LayoutDashboard,
  Opportunities: Search,
  Pursuits: Target,
  Company: Building2,
  Documents: FolderOpen,
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
  children,
}: {
  page: string;
  organization?: OrganizationChoice;
  choices?: OrganizationChoice[];
  userEmail?: string;
  records?: SearchRecord[];
  onHelp?: () => void;
  onNotifications?: () => void;
  children: React.ReactNode;
}) {
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [switcher, setSwitcher] = useState(false);
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
          <span className="company-avatar">{organization ? 'GE' : 'AE'}</span>
          <span>
            <b>{name}</b>
            <small>{organization ? 'Authenticated workspace' : 'Fictional demonstration'}</small>
          </span>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {Object.entries(sections).map(([label, path]) => {
            const Icon = icons[label as keyof typeof icons];
            return (
              <Link
                href={workspaceHref(path, organization?.id)}
                className={`nav-item ${page === label ? 'active' : ''}`}
                aria-current={page === label ? 'page' : undefined}
                onClick={() => setMobile(false)}
                key={label}
              >
                <Icon size={19} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="desk-note">
            <ShieldCheck size={23} />
            <b>
              Better decisions.
              <br />
              Stronger pursuits.
            </b>
            <p>The right facts. The right next step.</p>
          </div>
          {onHelp && (
            <button className="nav-item help" onClick={onHelp}>
              <CircleHelp size={19} />
              Workspace guide
            </button>
          )}
          <div className="profile">
            <span className="profile-avatar">{userEmail ? 'ME' : 'DM'}</span>
            <div>
              <b>{userEmail ? 'Signed in' : 'Demo member'}</b>
              <small>{organization?.role.replaceAll('_', ' ') ?? 'Preview access'}</small>
            </div>
          </div>
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
            <b>{page}</b>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button"
              aria-label="Global search"
              onClick={() => setSearch(true)}
            >
              <Search size={19} />
            </button>
            <span className="preview-badge">
              <span />
              {organization ? 'Onboarding' : 'Interactive preview'}
            </span>
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
        {children}
      </div>
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
