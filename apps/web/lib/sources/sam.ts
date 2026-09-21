// Operator/server module. Never import this module into a client component.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Change, Notice, Snapshot, SourceConnector } from './contracts';

export class SourceError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value) ?? 'null';
}
export const checksum = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
function string(v: unknown): string | null {
  return typeof v === 'string' && v.trim() && v !== 'null' ? v.trim() : null;
}
function url(v: unknown): string | null {
  try {
    const u = new URL(String(v));
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    for (const key of [...u.searchParams.keys()])
      if (/key|token|credential|signature|authorization/i.test(key)) u.searchParams.delete(key);
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 12) throw new SourceError('snapshot_depth');
  if (typeof value === 'string') return /^https?:/i.test(value) ? url(value) : value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !/key|token|password|authorization|credential|signature/i.test(k))
        .map(([k, v]) => [k, sanitize(v, depth + 1)]),
    );
  return value;
}
export function normalizeSam(input: unknown, secret = ''): Snapshot {
  const serialized = JSON.stringify(input);
  if (!serialized || Buffer.byteLength(serialized) > 65536) throw new SourceError('snapshot_size');
  // Reject unexpected credential echoes anywhere, including non-URL fields.
  if (secret && serialized.includes(secret)) throw new SourceError('credential_echo');
  const raw = sanitize(input);
  if (!raw || Array.isArray(raw) || typeof raw !== 'object')
    throw new SourceError('malformed_record');
  const r = raw as Record<string, unknown>;
  const noticeId = string(r.noticeId);
  const title = string(r.title);
  if (!noticeId || !/^[a-zA-Z0-9-]{1,100}$/.test(noticeId) || !title || title.length > 1000)
    throw new SourceError('malformed_record');
  const hierarchy = string(r.fullParentPathName)?.split('.') ?? [];
  const deadline = string(r.responseDeadLine ?? r.responseDeadline);
  const instant =
    deadline &&
    z.iso.datetime({ offset: true }).safeParse(deadline).success &&
    Number.isFinite(Date.parse(deadline))
      ? new Date(deadline).toISOString()
      : null;
  const notice: Notice = {
    noticeId,
    title,
    solicitationNumber: string(r.solicitationNumber),
    department: hierarchy[0] ?? string(r.department),
    subtier: hierarchy[1] ?? string(r.subTier),
    office: hierarchy.slice(2).join('.') || string(r.office),
    noticeType: string(r.type),
    baseType: string(r.baseType),
    setAside: string(r.typeOfSetAside),
    setAsideDescription: string(r.typeOfSetAsideDescription),
    naics: string(r.naicsCode),
    classification: string(r.classificationCode),
    published: string(r.postedDate),
    modified: null,
    deadline,
    deadlineInstant: instant,
    status: /cancel/i.test(string(r.type) ?? '')
      ? 'cancelled'
      : r.active === 'Yes'
        ? 'active'
        : r.active === 'No'
          ? 'inactive'
          : 'unknown',
    archiveDate: string(r.archiveDate),
    place: r.placeOfPerformance ?? null,
    officeAddress: r.officeAddress ?? null,
    contacts: r.pointOfContact ?? null,
    descriptionReference: url(r.description),
    resources: Array.isArray(r.resourceLinks)
      ? [...new Set(r.resourceLinks.map(url).filter((v): v is string => !!v))].sort()
      : [],
    award: r.award ?? null,
    sourceUrl:
      url(r.uiLink) && /(^|\.)sam\.gov$/.test(new URL(url(r.uiLink)!).hostname)
        ? url(r.uiLink)
        : null,
  };
  return { raw, notice, rawChecksum: checksum(raw), normalizedChecksum: checksum(notice) };
}
export function detectChange(before: Notice, after: Notice): Change {
  const fields = (Object.keys(after) as (keyof Notice)[]).filter(
    (k) => canonical(before[k]) !== canonical(after[k]),
  );
  let severity: Change['severity'] = fields.length ? 'informational' : 'none';
  if (
    fields.some((k) =>
      [
        'deadline',
        'status',
        'noticeType',
        'setAside',
        'naics',
        'classification',
        'place',
        'descriptionReference',
        'resources',
        'award',
      ].includes(k),
    )
  )
    severity = 'material';
  if (
    fields.includes('setAside') ||
    fields.includes('resources') ||
    (fields.includes('status') && after.status !== 'active') ||
    (fields.includes('deadline') &&
      (!after.deadlineInstant ||
        !before.deadlineInstant ||
        Date.parse(after.deadlineInstant) < Date.parse(before.deadlineInstant)))
  )
    severity = 'critical';
  return { fields, severity };
}
export function samConfig(env: Record<string, string | undefined>) {
  function bounded(key: string, fallback: number, max: number) {
    const value = env[key] === undefined || env[key] === '' ? fallback : Number(env[key]);
    if (!Number.isInteger(value) || value < 1 || value > max)
      throw new SourceError('invalid_configuration');
    return value;
  }
  return {
    enabled: env.BIDXCHANGE_SAM_SYNC_ENABLED === 'true',
    key: env.SAM_GOV_API_KEY ?? '',
    days: bounded('BIDXCHANGE_SAM_SYNC_LOOKBACK_DAYS', 7, 31),
    limit: bounded('BIDXCHANGE_SAM_SYNC_PAGE_LIMIT', 100, 100),
    pages: bounded('BIDXCHANGE_SAM_SYNC_MAX_PAGES', 5, 10),
    timeout: bounded('BIDXCHANGE_SAM_SYNC_TIMEOUT_MS', 10000, 30000),
  };
}
export function samConnector(
  config: ReturnType<typeof samConfig>,
  from: Date,
  to: Date,
  request: typeof fetch = fetch,
): SourceConnector {
  if (!config.enabled || !config.key) throw new SourceError('not_configured');
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from > to ||
    to.getTime() - from.getTime() > config.days * 86400000
  )
    throw new SourceError('invalid_range');
  const date = (d: Date) =>
    `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
  async function getPage(
    offset: number,
    signal?: AbortSignal,
    noticeId?: string,
    published?: string,
  ) {
    if (!Number.isInteger(offset) || offset < 0 || offset >= config.pages)
      throw new SourceError('page_limit');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const u = new URL('https://api.sam.gov/opportunities/v2/search');
        Object.entries({
          api_key: config.key,
          postedFrom: date(from),
          postedTo: date(to),
          limit: String(config.limit),
          offset: String(offset),
        }).forEach(([k, v]) => u.searchParams.set(k, v));
        if (noticeId && published) {
          const posted = new Date(published.slice(0, 10));
          if (
            !Number.isFinite(posted.getTime()) ||
            !z.iso.date().safeParse(published.slice(0, 10)).success
          )
            throw new SourceError('unknown_publication_date');
          u.searchParams.set('noticeid', noticeId);
          u.searchParams.set('postedFrom', date(posted));
          u.searchParams.set('postedTo', date(posted));
        }
        const response = await request(u, {
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(config.timeout)])
            : AbortSignal.timeout(config.timeout),
          redirect: 'error',
          cache: 'no-store',
        });
        if (response.status === 401 || response.status === 403)
          throw new SourceError('invalid_key');
        if (response.status === 429) throw new SourceError('rate_limited');
        if (response.status >= 500) throw new SourceError('unavailable');
        if (response.status === 404) return { records: [], total: 0 };
        if (!response.ok) throw new SourceError('request_rejected');
        if (!response.body) throw new SourceError('malformed_page');
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 8 * 1024 * 1024) throw new SourceError('page_size');
            chunks.push(value);
          }
        } finally {
          await reader.cancel();
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (
          !Array.isArray(body.opportunitiesData) ||
          body.opportunitiesData.length > config.limit ||
          !Number.isInteger(body.totalRecords) ||
          body.totalRecords < 0
        )
          throw new SourceError('malformed_page');
        return { records: body.opportunitiesData, total: body.totalRecords };
      } catch (error) {
        const code =
          error instanceof SourceError
            ? error.code
            : signal?.aborted
              ? 'cancelled'
              : error instanceof Error && /timeout|abort/i.test(error.name)
                ? 'timeout'
                : 'unavailable';
        if (attempt === 2 || !['unavailable', 'timeout'].includes(code))
          throw new SourceError(code);
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
    throw new SourceError('unavailable');
  }
  return {
    id: 'sam.gov',
    page: getPage,
    refresh: (noticeId, published, signal) => getPage(0, signal, noticeId, published),
  };
}
