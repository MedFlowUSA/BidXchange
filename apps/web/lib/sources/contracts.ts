import { z } from 'zod';

const terms = z.array(z.string().trim().min(1).max(100)).max(30).default([]);
export const searchFilters = z
  .object({
    naics: terms,
    keywords: terms,
    excludedKeywords: terms,
    states: terms,
    agencies: terms,
    noticeTypes: terms,
    setAsides: terms,
    minimumDays: z.number().int().min(0).max(365).nullable().default(null),
    maximumDays: z.number().int().min(0).max(365).nullable().default(null),
  })
  .strict()
  .refine(
    (v) => v.minimumDays === null || v.maximumDays === null || v.minimumDays <= v.maximumDays,
    'Minimum response window exceeds maximum.',
  );
export type SearchFilters = z.infer<typeof searchFilters>;
export type Notice = {
  noticeId: string;
  title: string;
  solicitationNumber: string | null;
  department: string | null;
  subtier: string | null;
  office: string | null;
  noticeType: string | null;
  baseType: string | null;
  setAside: string | null;
  setAsideDescription: string | null;
  naics: string | null;
  classification: string | null;
  published: string | null;
  modified: string | null;
  deadline: string | null;
  deadlineInstant: string | null;
  status: 'active' | 'inactive' | 'cancelled' | 'unknown';
  archiveDate: string | null;
  place: unknown;
  officeAddress: unknown;
  contacts: unknown;
  descriptionReference: string | null;
  resources: string[];
  award: unknown;
  sourceUrl: string | null;
};
export type Change = {
  fields: string[];
  severity: 'critical' | 'material' | 'informational' | 'none';
};
export type Snapshot = {
  notice: Notice;
  raw: unknown;
  rawChecksum: string;
  normalizedChecksum: string;
};
export type SourceConnector = {
  id: 'sam.gov';
  page(offset: number, signal?: AbortSignal): Promise<{ records: unknown[]; total: number }>;
  refresh?(
    noticeId: string,
    published: string,
    signal?: AbortSignal,
  ): Promise<{ records: unknown[]; total: number }>;
};

export function matchNotice(notice: Notice, filters: SearchFilters, now: Date) {
  const reasons: string[] = [];
  const missing: string[] = [];
  const text = `${notice.title} ${notice.solicitationNumber ?? ''}`.toLowerCase();
  if (filters.excludedKeywords.some((k) => text.includes(k.toLowerCase()))) return null;
  const place = notice.place as { state?: { code?: string } } | null;
  const checks: [string, string[], string | null][] = [
    ['NAICS', filters.naics, notice.naics],
    ['State', filters.states, place?.state?.code ?? null],
    [
      'Agency',
      filters.agencies,
      [notice.department, notice.subtier, notice.office].filter(Boolean).join(' / ') || null,
    ],
    ['Notice type', filters.noticeTypes, notice.noticeType],
    ['Set-aside filter', filters.setAsides, notice.setAside],
    ['Title keyword', filters.keywords, text],
  ];
  for (const [label, values, actual] of checks) {
    if (!values.length) continue;
    if (!actual) {
      missing.push(label);
      continue;
    }
    const found = values.some((v) =>
      ['Agency', 'Title keyword'].includes(label)
        ? actual.toLowerCase().includes(v.toLowerCase())
        : actual.toLowerCase() === v.toLowerCase(),
    );
    if (!found) return null;
    reasons.push(`${label}: ${actual}`);
  }
  if (filters.minimumDays !== null || filters.maximumDays !== null) {
    if (!notice.deadlineInstant) missing.push('Unambiguous response deadline');
    else {
      const days = (Date.parse(notice.deadlineInstant) - now.getTime()) / 86400000;
      if (days < (filters.minimumDays ?? 0) || days > (filters.maximumDays ?? 365)) return null;
      reasons.push('Response window matches');
    }
  }
  return {
    reasons: reasons.length ? reasons : ['No known filter conflict; review missing information'],
    missing,
  };
}
