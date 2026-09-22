import { z } from 'zod';
const terms = z.array(z.string().trim().min(1).max(100)).max(12);
export const researchPlan = z
  .object({
    keywords: terms,
    naics: terms,
    psc: terms,
    agencies: terms,
    states: terms,
    setAsides: terms,
    noticeTypes: terms,
    publishedFrom: z.iso.date().nullable(),
    publishedTo: z.iso.date().nullable(),
    deadlineFrom: z.iso.date().nullable(),
    deadlineTo: z.iso.date().nullable(),
    status: z.enum(['active', 'archived', 'all']),
    source: z.enum(['sam.gov', 'workspace', 'all']),
    intent: z.enum(['discover', 'changes', 'prime', 'teaming', 'grants', 'profitability']),
    radiusMiles: z.number().int().min(1).max(10000).nullable(),
    origin: z.string().max(200).nullable(),
    limit: z.number().int().min(1).max(10),
  })
  .strict();
export type ResearchPlan = z.infer<typeof researchPlan>;
export const researchRequest = z
  .object({
    organizationId: z.uuid(),
    requestId: z.uuid(),
    prompt: z.string().trim().min(1).max(3000),
    previousPlan: researchPlan.nullable(),
  })
  .strict();
export type ResearchNotice = {
  id: string;
  source: string;
  title: string;
  agency: string | null;
  naics: string | null;
  psc: string | null;
  state: string | null;
  setAside: string | null;
  noticeType: string | null;
  published: string | null;
  deadline: string | null;
  status: string;
  sourceUrl: string | null;
  synchronizedAt: string | null;
  version: string;
  changedFields: string[];
  workspaceUrl: string;
  attachments: number | null;
  blockers: { requirement: string; href: string }[];
};
export type ResearchReport = {
  plan: ResearchPlan;
  checkedAt: string;
  reviewed: number;
  matched: number;
  sources: { id: string; status: string; lastSuccess: string | null }[];
  partial: boolean;
  warnings: string[];
  missingCompany: string[];
  results: {
    notice: ResearchNotice;
    matches: { component: string; points: number; evidenceIds: string[] }[];
    unknownFilters: string[];
    qualification: { area: string; status: string; reason: string }[];
    nextAction: string;
  }[];
};
