'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveSourceSearch, reviewSource } from '../app/source-actions';
import type { Notice, SearchFilters } from '../lib/sources/contracts';
import type { MutationState } from '../app/actions';

export type InboxItem = {
  id: string;
  updated_at: string;
  created_at: string;
  status: string;
  change_pending: boolean;
  priority: string;
  match_reasons: string[];
  missing_information: string[];
  assigned_user_id: string | null;
  opportunity_id: string | null;
  record: { first_seen: string; last_seen: string; current_version_id: string };
  versions: {
    id: string;
    prior_version_id: string | null;
    captured_at: string;
    normalized: Notice;
    changed_fields: string[];
    severity: string;
  }[];
};
export type SavedSearch = {
  id: string;
  name: string;
  filters: SearchFilters;
  active: boolean;
  updated_at: string;
  last_run: string | null;
};
const time = (s: string | null) => (s ? s : 'Unknown');
function SearchForm({ org, search }: { org: string; search?: SavedSearch }) {
  const [state, action, pending] = useActionState(saveSourceSearch, {} as MutationState);
  const empty = {
    naics: [],
    keywords: [],
    excludedKeywords: [],
    states: [],
    agencies: [],
    noticeTypes: [],
    setAsides: [],
    minimumDays: null,
    maximumDays: null,
  };
  const [filters, setFilters] = useState<SearchFilters>(search?.filters ?? empty);
  return (
    <details>
      <summary>{search ? search.name : 'Create a saved search'}</summary>
      <form action={action} className="panel" onReset={(e) => e.preventDefault()}>
        <input type="hidden" name="organization_id" value={org} />
        <input type="hidden" name="id" value={search?.id ?? ''} />
        <input type="hidden" name="updated_at" value={search?.updated_at ?? ''} />
        <input type="hidden" name="filters" value={JSON.stringify(filters)} />
        <label>
          Search name
          <input name="name" required maxLength={120} defaultValue={search?.name} />
        </label>
        {(
          [
            'naics',
            'keywords',
            'excludedKeywords',
            'states',
            'agencies',
            'noticeTypes',
            'setAsides',
          ] as const
        ).map((key) => (
          <label key={key}>
            {
              {
                naics: 'NAICS codes',
                keywords: 'Title keywords',
                excludedKeywords: 'Excluded title keywords',
                states: 'State codes',
                agencies: 'Agencies or offices',
                noticeTypes: 'Notice type names',
                setAsides: 'Set-aside codes',
              }[key]
            }{' '}
            (comma separated)
            <input
              defaultValue={filters[key].join(', ')}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  [key]: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
        ))}
        <label>
          Minimum days to respond
          <input
            type="number"
            min={0}
            max={365}
            value={filters.minimumDays ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                minimumDays: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <label>
          Maximum days to respond
          <input
            type="number"
            min={0}
            max={365}
            value={filters.maximumDays ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                maximumDays: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <label>
          <input type="checkbox" name="activate" defaultChecked={search?.active} /> I reviewed these
          filters. Activate this search.
        </label>
        <p>
          Filters match metadata, not eligibility. Keywords search titles and solicitation numbers,
          not downloaded descriptions. Unknown fields are flagged for review.
        </p>
        <button disabled={pending || state.success}>Save search</button>
        <p role="status">{state.message}</p>
        {state.success && (
          <button type="button" onClick={() => location.reload()}>
            Reload saved searches
          </button>
        )}
      </form>
    </details>
  );
}
function ReviewForm({
  org,
  item,
  members,
}: {
  org: string;
  item: InboxItem;
  members: { user_id: string }[];
}) {
  const [state, action, pending] = useActionState(reviewSource, {} as MutationState);
  return (
    <form action={action} onReset={(e) => e.preventDefault()}>
      <input type="hidden" name="organization_id" value={org} />
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="updated_at" value={item.updated_at} />
      <input type="hidden" name="version" value={item.record.current_version_id} />
      <label>
        Next action
        <select name="disposition" defaultValue="needs_review">
          <option value="needs_review">Review</option>
          <option value="saved">Save for later</option>
          <option value="dismissed">Dismiss</option>
          {!item.opportunity_id && (
            <option value="converted">Convert to company opportunity</option>
          )}
        </select>
      </label>
      <label>
        Assigned reviewer
        <select name="reviewer" defaultValue={item.assigned_user_id ?? ''}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.user_id}
            </option>
          ))}
        </select>
      </label>
      <label>
        Review reason
        <textarea name="reason" required maxLength={2000} />
      </label>
      {!item.opportunity_id && (
        <label>
          <input type="checkbox" name="confirm" /> Confirm conversion if selected: create an
          opportunity for human review. No pursuit or bid decision.
        </label>
      )}
      <button disabled={pending || state.success}>Save review</button>
      <p role="status">{state.message}</p>
      {state.href && <Link href={state.href}>Open company opportunity</Link>}
      {state.success && (
        <button type="button" onClick={() => location.reload()}>
          Reload inbox
        </button>
      )}
    </form>
  );
}
export default function SourceInbox({
  org,
  items,
  searches,
  canEdit,
  members,
  asOf,
  serverFilter,
}: {
  org: string;
  items: InboxItem[];
  searches: SavedSearch[];
  canEdit: boolean;
  members: { user_id: string }[];
  asOf: string;
  serverFilter?: string;
}) {
  const [filter, setFilter] = useState(serverFilter ?? 'all');
  const router = useRouter();
  return (
    <div>
      {canEdit && (
        <section className="panel">
          <h2>Saved searches</h2>
          <SearchForm org={org} />
          {searches.map((s) => (
            <SearchForm key={s.id} org={org} search={s} />
          ))}
        </section>
      )}
      <label>
        Inbox view
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            if (serverFilter !== undefined)
              router.push(`?organization=${org}&view=${e.target.value}`);
          }}
        >
          <option value="all">All</option>
          <option value="new">New from sources</option>
          <option value="needs_review">Needs review</option>
          <option value="saved">Saved</option>
          <option value="converted">Converted</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </label>
      {items
        .filter(
          (i) =>
            filter === 'all' ||
            i.status === filter ||
            (filter === 'needs_review' && i.change_pending),
        )
        .map((item) => {
          const current = item.versions.find((v) => v.id === item.record.current_version_id);
          if (!current) return null;
          const n = current.normalized;
          const stale = Date.parse(asOf) - Date.parse(item.record.last_seen) > 36 * 3600000;
          return (
            <article key={item.id} className="panel" style={{ overflowWrap: 'anywhere' }}>
              <p>Official SAM.gov source · {item.status.replaceAll('_', ' ')}</p>
              <h2>{n.title}</h2>
              <p>
                {n.department ?? 'Agency unknown'} · {n.noticeType ?? 'Notice type unknown'} ·{' '}
                {n.status}
              </p>
              <p>
                Response deadline: {time(n.deadline)}
                {n.deadline && !n.deadlineInstant
                  ? ' — timezone unverified; confirm at source'
                  : n.deadlineInstant
                    ? ' (offset supplied by source)'
                    : ''}
              </p>
              <p>
                {stale
                  ? 'Freshness warning: last observed more than 36 hours ago.'
                  : 'Recently observed; confirm current source before acting.'}{' '}
                A sync does not verify eligibility.
              </p>
              {item.change_pending && (
                <p role="status">
                  {item.priority === 'critical' ? 'Critical source change' : 'Source change'} —
                  human review required. Saved requirements were not rewritten.
                </p>
              )}
              <p>Why this appeared: {item.match_reasons.join('; ')}</p>
              {item.missing_information.length > 0 && (
                <p>Missing information: {item.missing_information.join(', ')}</p>
              )}
              <details>
                <summary>Source dates, filters and observed history</summary>
                <p>Published by source: {time(n.published)}</p>
                <p>First added to BidXchange: {item.record.first_seen}</p>
                <p>Added to this queue: {item.created_at}</p>
                <p>Last synchronized: {item.record.last_seen}</p>
                <p>
                  Last modified at source: {time(n.modified)} (not supplied by this API contract)
                </p>
                <p>
                  NAICS: {time(n.naics)} · Set-aside: {time(n.setAside)} · Classification:{' '}
                  {time(n.classification)}
                </p>
                <p>Place of performance: {JSON.stringify(n.place)}</p>
                {n.sourceUrl && (
                  <a href={n.sourceUrl} target="_blank" rel="noreferrer">
                    Open official notice
                  </a>
                )}
                {item.versions.map((v) => (
                  <details key={v.id}>
                    <summary>
                      {v.captured_at} · {v.severity} ·{' '}
                      {v.id === current.id ? 'Current observed version' : 'Prior observed version'}
                    </summary>
                    <p>
                      Version: {v.id} · Prior: {v.prior_version_id ?? 'None'}
                    </p>
                    <p>Changed: {v.changed_fields.join(', ') || 'No normalized change'}</p>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(v.normalized, null, 2)}
                    </pre>
                  </details>
                ))}
              </details>
              {item.opportunity_id && (
                <Link href={`/opportunities/${item.opportunity_id}?organization=${org}`}>
                  Open converted opportunity
                </Link>
              )}
              {canEdit && (
                <details>
                  <summary>Review and choose next action</summary>
                  <ReviewForm org={org} item={item} members={members} />
                </details>
              )}
            </article>
          );
        })}
      {!items.length && (
        <p>
          No source matches in this page. A saved search needs a successful operator synchronization
          before results can appear.
        </p>
      )}
    </div>
  );
}
