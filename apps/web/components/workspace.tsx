'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from './app-shell';
import Dialog from './dialog';
import AiPreview from './ai-preview';
import PursuitFoundation from './pursuit-foundation';
import { sections, workspaceHref, type OrganizationChoice } from '../lib/routes';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileText,
  FolderOpen,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { qualify } from '../../../packages/scoring';
import { seedOpportunities, sampleDocuments, type Opportunity, type Stage } from '../lib/demo';

const money = (n: number | null) =>
  n === null
    ? 'Not published'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 2,
      }).format(n);
const due = (o: Opportunity) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: o.timezone,
    timeZoneName: 'short',
  }).format(new Date(o.deadline));
const storageKey = 'bidxchange-demo-v1';
const isOpportunity = (v: unknown): v is Opportunity => {
  if (!v || typeof v !== 'object') return false;
  const o = v as Opportunity;
  return (
    ['id', 'title', 'buyer', 'category', 'location', 'source', 'timezone', 'summary'].every(
      (k) => typeof (v as Record<string, unknown>)[k] === 'string',
    ) &&
    !Number.isNaN(Date.parse(o.deadline)) &&
    o.timezone === 'America/Los_Angeles' &&
    ['Inbox', 'In review', 'Pursuing', 'Passed'].includes(o.stage) &&
    (o.value === null || (Number.isFinite(o.value) && o.value >= 0)) &&
    Array.isArray(o.gates) &&
    o.gates.every(
      (g) =>
        g &&
        typeof g.name === 'string' &&
        typeof g.evidence === 'string' &&
        ['pass', 'fail', 'unknown'].includes(g.status),
    ) &&
    Array.isArray(o.factors) &&
    o.factors.every(
      (f) =>
        f && typeof f.name === 'string' && Number.isFinite(f.score) && Number.isFinite(f.weight),
    ) &&
    Array.isArray(o.tasks) &&
    o.tasks.every((t) => t && typeof t.title === 'string' && typeof t.done === 'boolean')
  );
};

export default function Workspace({
  initialPage = 'Today',
  recordId,
  recordType,
  choices = [],
  userEmail,
}: {
  initialPage?: string;
  recordId?: string;
  recordType?: 'opportunity' | 'pursuit';
  choices?: OrganizationChoice[];
  userEmail?: string;
}) {
  const router = useRouter();
  const page = recordId
    ? recordType === 'pursuit'
      ? 'Pursuit workspace'
      : 'Opportunity details'
    : initialPage;
  const setPage = (name: string) => router.push(workspaceHref(sections[name] ?? '/dashboard'));
  const setSelectedId = (id: string) =>
    router.push(workspaceHref('/opportunities/' + encodeURIComponent(id)));
  const [items, setItems] = useState<Opportunity[]>(seedOpportunities);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All opportunities');
  const [category, setCategory] = useState('All categories');
  const [modal, setModal] = useState<'add' | 'help' | 'notifications' | null>(null);
  const [document, setDocument] = useState<(typeof sampleDocuments)[number] | null>(null);
  const [toast, setToast] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed.items) &&
          parsed.items.length <= 1000 &&
          parsed.items.every(isOpportunity)
        ) {
          setItems(parsed.items);
          setEvents(
            Array.isArray(parsed.events)
              ? parsed.events.filter((x: unknown) => typeof x === 'string').slice(0, 100)
              : [],
          );
        } else setToast('Saved demo data was invalid. Sample workspace restored.');
      }
    } catch {
      setToast('Local storage unavailable. Changes will last for this visit.');
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ items, events }));
      } catch {
        setToast('Could not save locally. Keep this tab open to retain your changes.');
      }
    }
  }, [items, events, loaded]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const selected = items.find((o) => o.id === recordId);
  const strong = items.filter(
    (o) => qualify(o.gates, o.factors).band === 'Strong fit' && o.stage !== 'Passed',
  );
  const pursuits = items.filter((o) => o.stage === 'Pursuing');
  const openTasks = pursuits.flatMap((o) =>
    o.tasks.filter((t) => !t.done).map((t) => ({ ...t, opportunity: o })),
  );
  const filtered = items.filter(
    (o) =>
      `${o.title} ${o.buyer} ${o.location}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'All opportunities' ||
        (filter === 'Strong fit'
          ? qualify(o.gates, o.factors).band === filter
          : o.stage === filter)) &&
      (category === 'All categories' || o.category === category),
  );
  const go = (name: string) => {
    setPage(name);
    setQuery('');
  };
  const record = (message: string) => {
    setEvents((prev) => [`${new Date().toLocaleString()} · ${message}`, ...prev].slice(0, 100));
    setToast(message);
  };
  const stage = (o: Opportunity, next: Stage) => {
    if (next === 'Pursuing' && qualify(o.gates, o.factors).score === null) {
      setToast('Resolve eligibility before advancing to a pursuit.');
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === o.id ? { ...i, stage: next } : i)));
    record(`${o.id} moved to ${next.toLowerCase()} in the demo.`);
  };
  const exportReport = () => {
    const report = [
      'BidXchange — fictional demo brief',
      `Exported: ${new Date().toISOString()}`,
      'All values are illustrative opportunity estimates, not awards or revenue.',
      '',
      ...items.map(
        (o) =>
          `${o.id} | ${o.title}\n${o.stage} · ${qualify(o.gates, o.factors).band} · ${money(o.value)}\nDue ${due(o)} · ${o.timezone}\nSource: ${o.source} (fictional)\n`,
      ),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
    const link = window.document.createElement('a');
    link.href = url;
    link.download = 'bidxchange-demo-brief.txt';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setToast('Demo brief exported.');
  };
  const addOpportunity = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const deadline = new Date(String(form.get('deadline')));
    if (Number.isNaN(deadline.getTime())) return;
    const title = String(form.get('title')).trim();
    const buyer = String(form.get('buyer')).trim();
    if (!title || !buyer) {
      setToast('Enter a title and buyer.');
      return;
    }
    const opportunity: Opportunity = {
      id: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      title,
      buyer,
      category: String(form.get('category')),
      location: String(form.get('location')).trim() || 'Not specified',
      source: 'Manual demo entry',
      deadline: deadline.toISOString(),
      timezone: 'America/Los_Angeles',
      value: form.get('value') ? Number(form.get('value')) : null,
      summary: String(form.get('summary')).trim() || 'No scope summary provided.',
      stage: 'Inbox',
      gates: [
        {
          name: 'Eligibility verification',
          status: 'unknown',
          evidence: 'Verify source requirements and company evidence before qualification.',
        },
      ],
      factors: [],
      tasks: [{ title: 'Verify source and eligibility', done: false }],
    };
    setItems((prev) => [opportunity, ...prev]);
    setModal(null);
    setPage('Opportunities');
    setFilter('All opportunities');
    setCategory('All categories');
    setQuery('');
    record('Demo opportunity added. Eligibility needs review.');
  };
  const card = (o: Opportunity) => {
    const fit = qualify(o.gates, o.factors);
    return (
      <Link className="opportunity-card" key={o.id} href={workspaceHref(`/opportunities/${o.id}`)}>
        <div className="card-top">
          <span className="category">{o.category}</span>
          <span
            className={`fit ${fit.band === 'Strong fit' ? 'green' : fit.band === 'Not eligible' ? 'red' : 'amber'}`}
          >
            {fit.score !== null && <b>{fit.score}</b>}
            {fit.band}
          </span>
        </div>
        <h3>{o.title}</h3>
        <p>{o.buyer}</p>
        <div className="card-meta">
          <span>{o.location}</span>
          <span>Manual · Sample</span>
        </div>
        <div className="card-bottom">
          <div>
            <small>EST. CONTRACT VALUE</small>
            <strong>{money(o.value)}</strong>
          </div>
          <div className="card-date">
            <CalendarDays size={14} />
            {new Date(o.deadline).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: o.timezone,
            })}
            <ChevronRight size={16} />
          </div>
        </div>
      </Link>
    );
  };

  const searchRecords = [
    ...items.map((o) => ({
      title: o.title,
      category: 'Opportunity',
      text: o.buyer + ' ' + o.id,
      href: workspaceHref('/opportunities/' + o.id),
    })),
    ...items
      .filter((o) => o.stage !== 'Inbox')
      .map((o) => ({
        title: o.title,
        category: 'Pursuit',
        href: workspaceHref('/pursuits/' + o.id),
      })),
    ...sampleDocuments.map((d) => ({
      title: d.name,
      category: 'Document',
      href: workspaceHref('/documents'),
    })),
    {
      title: 'Apex Energy Demo capabilities',
      category: 'Company facts',
      href: workspaceHref('/company'),
    },
  ];
  return (
    <AppShell
      page={recordId ? (recordType === 'pursuit' ? 'Pursuits' : 'Opportunities') : page}
      choices={choices}
      userEmail={userEmail}
      records={searchRecords}
      onHelp={() => setModal('help')}
      onNotifications={() => setModal('notifications')}
    >
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR GOVERNMENT CONTRACTING WORKSPACE</div>
            <h1>{page === 'Today' ? 'A clear path to your next pursuit.' : page}</h1>
            <p>
              {
                (
                  {
                    Today: 'The right opportunities. The next priorities. All in one place.',
                    Opportunities: 'Find the work that fits. Know why it matters.',
                    Pursuits: 'Keep every response moving, from decision to readiness.',
                    Company: 'Strong pursuits start with verified company facts.',
                    Documents: 'The evidence and templates behind a confident response.',
                    Reports: 'A clear view of your pipeline and the work behind it.',
                  } as Record<string, string>
                )[page]
              }
            </p>
          </div>
          <button className="button primary" onClick={() => setModal('add')}>
            <Plus size={17} />
            Add opportunity
          </button>
        </div>
        <div className="demo-banner">
          <span>
            <Sparkles size={15} />
            <b>A workspace to explore.</b> Fictional sample data · Changes saved in this browser.
          </span>
          <button onClick={() => setModal('help')}>
            About this preview <ArrowUpRight size={14} />
          </button>
        </div>

        {page === 'Today' && (
          <>
            <div className="stats-grid">
              {[
                {
                  label: 'Opportunities to review',
                  value: items.filter((o) => o.stage === 'Inbox').length,
                  icon: Search,
                  sub: 'Ready for a closer look',
                  className: 'blue',
                },
                {
                  label: 'Strong-fit opportunities',
                  value: strong.length,
                  icon: ShieldCheck,
                  sub: 'Passed sample eligibility checks',
                  className: 'green',
                },
                {
                  label: 'Active pursuits',
                  value: pursuits.length,
                  icon: Target,
                  sub: 'From qualification to readiness',
                  className: 'golden',
                },
                {
                  label: 'Open pursuit tasks',
                  value: openTasks.length,
                  icon: ClipboardList,
                  sub: 'Your next steps, in focus',
                  className: 'purple',
                },
              ].map(({ label, value, icon: Icon, sub, className }) => (
                <div className="stat-card" key={label}>
                  <div>
                    <span>{label}</span>
                    <Icon size={19} className={className} />
                  </div>
                  <strong>{String(value).padStart(2, '0')}</strong>
                  <small>{sub}</small>
                </div>
              ))}
            </div>
            <div className="dashboard-columns">
              <section>
                <div className="section-heading">
                  <div>
                    <h2>
                      Worth a closer look <span className="count-pill">{strong.length}</span>
                    </h2>
                    <p>Your highest-fit opportunities, with the reasoning to back them.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      go('Opportunities');
                      setFilter('Strong fit');
                    }}
                  >
                    View inbox <ArrowRight size={16} />
                  </button>
                </div>
                <div className="opportunity-grid">
                  {strong.slice(0, 2).map(card)}
                  {!strong.length && (
                    <div className="empty-state">
                      No strong-fit opportunities yet. Review the inbox to get started.
                    </div>
                  )}
                </div>
                <div className="section-heading priorities-heading">
                  <div>
                    <h2>Keep things moving</h2>
                    <p>A little progress today. A stronger response tomorrow.</p>
                  </div>
                  <span className="subtle-label">PURSUIT TASKS</span>
                </div>
                <div className="task-list">
                  {openTasks.slice(0, 3).map((t, i) => (
                    <button
                      className="task-row"
                      key={`${t.opportunity.id}-${t.title}`}
                      onClick={() => setSelectedId(t.opportunity.id)}
                    >
                      <span className="task-number">0{i + 1}</span>
                      <div>
                        <b>{t.title}</b>
                        <small>{t.opportunity.title}</small>
                      </div>
                      <span className="task-chip">To do</span>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                  {!openTasks.length && (
                    <div className="empty-state">
                      <CheckCircle2 size={24} />
                      All pursuit tasks are complete.
                    </div>
                  )}
                </div>
              </section>
              <aside className="right-column">
                <div className="readiness-card">
                  <div className="section-heading">
                    <h2>A stronger starting point</h2>
                    <ShieldCheck size={20} />
                  </div>
                  <p>Your company readiness</p>
                  <div className="readiness-value">
                    4<span>/ 6</span>
                    <span className="amber mini-badge">2 to review</span>
                  </div>
                  <div className="readiness-progress">
                    <span />
                  </div>
                  <div className="readiness-row">
                    <CheckCircle2 size={15} />
                    Core capabilities<span>Ready</span>
                  </div>
                  <div className="readiness-row">
                    <CheckCircle2 size={15} />
                    Service territory<span>Ready</span>
                  </div>
                  <div className="readiness-row pending">
                    <span className="small-circle" />
                    Insurance evidence<span>Review</span>
                  </div>
                  <button className="button secondary full" onClick={() => go('Company')}>
                    Review company profile
                    <ArrowRight size={15} />
                  </button>
                  <small>Illustrative readiness · not verified client data</small>
                </div>
                <div className="brief-card">
                  <span className="brief-icon">
                    <FileText size={23} />
                  </span>
                  <div className="eyebrow">THE BIG PICTURE</div>
                  <h2>
                    Your opportunity brief.
                    <br />
                    Ready when you are.
                  </h2>
                  <p>Bring the pipeline, fit, and next steps into your next conversation.</p>
                  <button onClick={exportReport}>
                    Export demo brief <ArrowDownToLine size={16} />
                  </button>
                </div>
              </aside>
            </div>
            <div className="source-strip">
              <span className="source-icon">
                <FolderOpen size={18} />
              </span>
              <div>
                <b>Start focused. Expand with confidence.</b>
                <p>
                  Manual opportunity intake is available. Procurement source connections come next.
                </p>
              </div>
              <span className="outline-tag">No live feeds connected</span>
            </div>
          </>
        )}

        {page === 'Opportunities' && (
          <>
            <div className="inbox-toolbar">
              <label className="search-field">
                <Search size={18} />
                <input
                  aria-label="Search opportunities"
                  placeholder="Search title, buyer, or location…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label className="select-field">
                <SlidersHorizontal size={16} />
                <select
                  aria-label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option>All categories</option>
                  {[...new Set(items.map((o) => o.category))].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="filter-tabs">
              {['All opportunities', 'Strong fit', 'Inbox', 'In review', 'Pursuing', 'Passed'].map(
                (f) => (
                  <button
                    key={f}
                    className={filter === f ? 'selected' : ''}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                    {f === 'All opportunities' && <span>{items.length}</span>}
                  </button>
                ),
              )}
            </div>
            <div className="results-label">
              {filtered.length} opportunities{' '}
              <span>Sorted by intake order · Fictional dataset</span>
            </div>
            <div className="opportunity-grid inbox-grid">{filtered.map(card)}</div>
            {!filtered.length && (
              <div className="empty-state">
                <Search size={28} />
                <h3>No opportunities found</h3>
                <p>Try a different search or filter.</p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setQuery('');
                    setFilter('All opportunities');
                    setCategory('All categories');
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </>
        )}

        {page === 'Pursuits' && (
          <>
            <div className="info-note">
              <ShieldCheck size={19} />
              Demo stages are for workflow testing. Live bid decisions will require an authorized
              client approver.
            </div>
            <div className="pursuit-grid">
              {['In review', 'Pursuing', 'Passed'].map((s) => (
                <section className="pursuit-column" key={s}>
                  <h2>
                    <span className={`stage-dot ${s === 'Pursuing' ? 'green-dot' : ''}`} />
                    {s}
                    <span>{items.filter((o) => o.stage === s).length}</span>
                  </h2>
                  {items
                    .filter((o) => o.stage === s)
                    .map((o) => (
                      <Link
                        className="pursuit-card"
                        href={workspaceHref(`/pursuits/${o.id}`)}
                        key={o.id}
                      >
                        <small>{o.id}</small>
                        <h3>{o.title}</h3>
                        <p>{o.buyer}</p>
                        <div className="pursuit-progress">
                          <span
                            style={{
                              width: `${(o.tasks.filter((t) => t.done).length / o.tasks.length) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="flex-between">
                          <small>
                            {o.tasks.filter((t) => t.done).length}/{o.tasks.length} tasks complete
                          </small>
                          <ArrowUpRight size={16} />
                        </div>
                      </Link>
                    ))}
                  {!items.some((o) => o.stage === s) && (
                    <div className="column-empty">No opportunities in this stage.</div>
                  )}
                </section>
              ))}
            </div>
          </>
        )}

        {page === 'Company' && (
          <>
            <div className="company-hero">
              <span className="large-avatar">AE</span>
              <div>
                <div className="eyebrow">FICTIONAL COMPANY PROFILE</div>
                <h2>Apex Energy Demo</h2>
                <p>Energy efficiency · Building upgrades · Pool rehabilitation</p>
              </div>
              <span className="outline-tag">Southern California</span>
            </div>
            <div className="company-grid">
              {[
                {
                  title: 'Core capabilities',
                  value: 'Energy & building improvements',
                  detail: 'NAICS 238990 · Sample classification',
                  status: 'Sample ready',
                },
                {
                  title: 'Service territory',
                  value: 'Southern California',
                  detail: 'Los Angeles, Orange, Riverside, San Bernardino, San Diego',
                  status: 'Sample ready',
                },
                {
                  title: 'Licenses',
                  value: 'B · General Building / C-53 · Pools',
                  detail: 'Fictional credentials. No real license number is used.',
                  status: 'Sample ready',
                },
                {
                  title: 'Supplier registrations',
                  value: 'Local supplier profile',
                  detail: 'Sample validity through December 2026',
                  status: 'Sample ready',
                },
                {
                  title: 'Insurance evidence',
                  value: 'Evidence required',
                  detail: 'Upload and verification workflow is planned for the secure pilot.',
                  status: 'Needs review',
                },
                {
                  title: 'Bonding capacity',
                  value: '$2M single-project limit',
                  detail: 'Illustrative only · aggregate capacity needs confirmation',
                  status: 'Needs review',
                },
              ].map((f) => (
                <div className="panel fact-card" key={f.title}>
                  <div className="flex-between">
                    <h3>{f.title}</h3>
                    <span className={`fit ${f.status === 'Needs review' ? 'amber' : 'green'}`}>
                      {f.status}
                    </span>
                  </div>
                  <strong>{f.value}</strong>
                  <p>{f.detail}</p>
                  <div className="fact-source">Source: fictional seed · Owner: demo member</div>
                </div>
              ))}
            </div>
            <div className="info-note">
              <ShieldCheck size={20} />
              Real company facts will retain source, owner, verification history, and expiration
              dates. This preview does not verify or publish credentials.
            </div>
          </>
        )}

        {page === 'Documents' && (
          <>
            <div className="info-note">
              <FolderOpen size={20} />
              Explore sample evidence and reusable checklists. Private uploads will follow
              authentication and tenant isolation.
            </div>
            <div className="document-list">
              {sampleDocuments.map((d) => (
                <button key={d.name} onClick={() => setDocument(d)}>
                  <span className="document-icon">
                    <FileText size={23} />
                  </span>
                  <div>
                    <h3>{d.name}</h3>
                    <p>{d.category} · Text preview</p>
                  </div>
                  <span className="outline-tag">{d.status}</span>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
          </>
        )}

        {page === 'Reports' && (
          <>
            <div className="report-heading">
              <div>
                <h2>Your pipeline, in perspective.</h2>
                <p>Fictional demo data · Updated with your changes in this browser</p>
              </div>
              <button className="button secondary" onClick={exportReport}>
                <ArrowDownToLine size={17} />
                Export brief
              </button>
            </div>
            <div className="report-grid">
              <section className="panel">
                <h2>Opportunity funnel</h2>
                <p>Where your attention is going.</p>
                {(['Inbox', 'In review', 'Pursuing', 'Passed'] as Stage[]).map((s) => (
                  <div className="funnel-row" key={s}>
                    <div>
                      <span>{s}</span>
                      <b>{items.filter((o) => o.stage === s).length}</b>
                    </div>
                    <div className="funnel-track">
                      <span
                        style={{
                          width: `${(items.filter((o) => o.stage === s).length / Math.max(items.length, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </section>
              <section className="panel">
                <h2>Estimated opportunity value</h2>
                <strong className="report-value">
                  {money(
                    items
                      .filter((o) => o.stage !== 'Passed')
                      .reduce((sum, o) => sum + (o.value ?? 0), 0),
                  )}
                </strong>
                <p>
                  Combined published estimates from fictional, non-passed opportunities. Not
                  contract awards, collected cash, or BidXchange revenue.
                </p>
                <div className="financial-row">
                  <span>Awarded value</span>
                  <b>No awards recorded</b>
                </div>
                <div className="financial-row">
                  <span>BidXchange revenue</span>
                  <b>Not tracked in preview</b>
                </div>
              </section>
            </div>
            <section className="panel activity-panel">
              <h2>Demo activity</h2>
              <p>
                Local workflow history. A server-enforced audit trail will be added with secure
                accounts.
              </p>
              {events.length ? (
                events.map((e, i) => (
                  <div className="activity-row" key={`${e}-${i}`}>
                    <span className="activity-dot" />
                    {e}
                  </div>
                ))
              ) : (
                <div className="empty-state compact">
                  Add an opportunity or update a pursuit to start the activity history.
                </div>
              )}
            </section>
          </>
        )}
        {recordId && !loaded && (
          <div className="panel" role="status">
            Loading demo record?
          </div>
        )}
        {recordId &&
          loaded &&
          (!selected || (recordType === 'pursuit' && selected.stage === 'Inbox')) && (
            <div className="panel">
              <h2>Record not found</h2>
              <p>This record does not exist in this demo workspace.</p>
              <Link href={workspaceHref('/opportunities')}>Return to opportunities</Link>
            </div>
          )}
        {page === 'Settings' && (
          <section className="panel">
            <h2>Apex Energy Demo settings</h2>
            <p>Fictional browser-local workspace. No real users or invitations.</p>
            <p>Default timezone: America/Los_Angeles</p>
            <p>Roles: demo member. No production authority.</p>
            <h3>Users and invitations</h3>
            <button disabled className="button secondary">
              Invitations unavailable in demo
            </button>
            <p>
              Qualification, notification, procurement-source, and audit settings will be available
              in authenticated workspaces.
            </p>
          </section>
        )}
        {page === 'Today' && <AiPreview />}
        {selected && (recordType !== 'pursuit' || selected.stage !== 'Inbox') && (
          <section className="panel record-page" aria-label="Opportunity details">
            <Link
              className="text-button"
              href={workspaceHref(recordType === 'pursuit' ? '/pursuits' : '/opportunities')}
            >
              ? Back to {recordType === 'pursuit' ? 'pursuits' : 'opportunities'}
            </Link>
            {recordType === 'pursuit' && (
              <PursuitFoundation
                demo
                source={selected.source + ' ? fictional'}
                deadline={due(selected)}
                timezone={selected.timezone}
                opportunityHref={workspaceHref('/opportunities/' + selected.id)}
              />
            )}
            <div className="detail-content">
              <div className="card-top">
                <span className="category">{selected.category}</span>
                <span className="outline-tag">{selected.id} · Fictional</span>
              </div>
              <h2 className="detail-title">{selected.title}</h2>
              <p>
                {selected.buyer} · {selected.location}
              </p>
              <div className="detail-metrics">
                <div>
                  <small>ESTIMATED VALUE</small>
                  <strong>{money(selected.value)}</strong>
                </div>
                <div>
                  <small>RESPONSE DEADLINE</small>
                  <strong>{due(selected)}</strong>
                  <small>{selected.timezone}</small>
                </div>
              </div>
              <h3>Scope at a glance</h3>
              <p>{selected.summary}</p>
              <div className="source-note">
                Source: {selected.source} · Sample data, no live source verification
              </div>
              <div className="detail-section-title">
                <h3>Eligibility comes first</h3>
                <span
                  className={`fit ${qualify(selected.gates, selected.factors).band === 'Strong fit' ? 'green' : 'amber'}`}
                >
                  {qualify(selected.gates, selected.factors).band}
                  {qualify(selected.gates, selected.factors).score !== null &&
                    ` · ${qualify(selected.gates, selected.factors).score}/100`}
                </span>
              </div>
              {selected.gates.map((g) => (
                <div className="gate-row" key={g.name}>
                  {g.status === 'pass' ? (
                    <CheckCircle2 className="green" size={19} />
                  ) : g.status === 'fail' ? (
                    <X className="red" size={19} />
                  ) : (
                    <CircleHelp className="amber-text" size={19} />
                  )}
                  <div>
                    <b>{g.name}</b>
                    <p>{g.evidence}</p>
                  </div>
                  <span>{g.status === 'unknown' ? 'Unverified' : g.status}</span>
                </div>
              ))}
              {qualify(selected.gates, selected.factors).score !== null && (
                <div className="factors">
                  {selected.factors.map((f) => (
                    <div key={f.name}>
                      <span>
                        {f.name}
                        <small>{f.weight}% weight</small>
                      </span>
                      <b>{f.score}/100</b>
                    </div>
                  ))}
                </div>
              )}
              <h3 className="task-title">Response checklist</h3>
              {selected.tasks.map((task, index) => (
                <label className="checklist-row" key={task.title}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => {
                      setItems((prev) =>
                        prev.map((o) =>
                          o.id === selected.id
                            ? {
                                ...o,
                                tasks: o.tasks.map((t, i) =>
                                  i === index ? { ...t, done: !t.done } : t,
                                ),
                              }
                            : o,
                        ),
                      );
                      record(
                        `${selected.id}: ${task.title} ${task.done ? 'reopened' : 'completed'}.`,
                      );
                    }}
                  />
                  <span>{task.title}</span>
                </label>
              ))}
              <div className="stage-controls">
                <label>
                  Demo workflow stage
                  <select
                    aria-label="Demo workflow stage"
                    value={selected.stage}
                    onChange={(e) => stage(selected, e.target.value as Stage)}
                  >
                    <option>Inbox</option>
                    <option>In review</option>
                    <option disabled={qualify(selected.gates, selected.factors).score === null}>
                      Pursuing
                    </option>
                    <option>Passed</option>
                  </select>
                </label>
                <p>
                  Unresolved or failed eligibility blocks advancing to pursuit. Live approval and
                  submission are not available in this preview.
                </p>
              </div>
            </div>
          </section>
        )}

        <footer>
          <span>
            BidXchange <span className="footer-dot">·</span> We Find. We Qualify. You Win.
          </span>
          <span>Built for a more confident pursuit.</span>
        </footer>
      </main>
      {modal === 'add' && (
        <Dialog title="Add a demo opportunity" close={() => setModal(null)}>
          <form onSubmit={addOpportunity} className="opportunity-form">
            <p>
              Test the intake workflow with fictional information. This record stays in your
              browser.
            </p>
            <label>
              Opportunity title
              <input
                name="title"
                required
                maxLength={180}
                placeholder="e.g. Community building energy upgrade"
              />
            </label>
            <label>
              Buyer / issuing office
              <input
                name="buyer"
                required
                maxLength={150}
                placeholder="e.g. Sample City · Public Works"
              />
            </label>
            <div className="form-grid">
              <label>
                Category
                <select name="category">
                  <option>Energy efficiency</option>
                  <option>Building upgrades</option>
                  <option>Pool rehabilitation</option>
                  <option>Electrification</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Location
                <input name="location" maxLength={150} placeholder="County, state" />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Deadline (your device timezone)
                <input type="datetime-local" name="deadline" required />
              </label>
              <label>
                Estimated value (USD)
                <input
                  name="value"
                  type="number"
                  min="0"
                  max="100000000000"
                  step="1"
                  placeholder="Optional"
                />
              </label>
            </div>
            <small>Deadline is saved in UTC and displayed in America/Los_Angeles.</small>
            <label>
              Scope summary
              <textarea
                name="summary"
                rows={3}
                maxLength={2000}
                placeholder="What work is required?"
              />
            </label>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="button primary" type="submit">
                <Plus size={16} />
                Add opportunity
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === 'help' && (
        <Dialog title="Your contract desk, taking shape" close={() => setModal(null)}>
          <div className="guide">
            <img src="/brand/bidxchange-logo.png" alt="BidXchange" />
            <p>
              Explore the first BidXchange workflow using Apex Energy Demo, a fictional contractor.
            </p>
            <ol>
              <li>Find and filter opportunities in the inbox.</li>
              <li>Open a record to inspect eligibility and fit.</li>
              <li>Move qualified opportunities into a demo pursuit.</li>
              <li>Complete tasks and export your opportunity brief.</li>
            </ol>
            <div className="info-note">
              This preview saves changes only in this browser. It does not contain live notices,
              real company credentials, authenticated accounts, AI analysis, or submission tools.
            </div>
            <button
              className="button secondary"
              onClick={() => {
                setItems(seedOpportunities);
                setEvents([]);
                setModal(null);
                setToast('Demo workspace reset to sample data.');
              }}
            >
              Reset demo workspace
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'notifications' && (
        <Dialog title="Needs your attention" close={() => setModal(null)}>
          <div className="notification-list">
            <button
              onClick={() => {
                setModal(null);
                go('Company');
              }}
            >
              <ShieldCheck size={23} />
              <div>
                <b>Two company areas need review</b>
                <p>Insurance evidence and aggregate bonding capacity.</p>
              </div>
              <ChevronRight size={17} />
            </button>
            <button
              onClick={() => {
                setModal(null);
                go('Pursuits');
              }}
            >
              <ClipboardList size={23} />
              <div>
                <b>{openTasks.length} open pursuit tasks</b>
                <p>Review the next steps for your active demo pursuits.</p>
              </div>
              <ChevronRight size={17} />
            </button>
            <small>Derived from the demo workspace. Email notifications are not enabled.</small>
          </div>
        </Dialog>
      )}
      {document && (
        <Dialog title={document.name} close={() => setDocument(null)}>
          <pre className="document-preview">{document.text}</pre>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </AppShell>
  );
}
