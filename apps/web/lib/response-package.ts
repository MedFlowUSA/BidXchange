import { z } from 'zod';
import type { TenantData } from './tenant-types';
import { pursuitBrief } from './pursuit-brief';
import { discloseFact } from './ai/policy';

export const responseDraftSchema = z
  .object({
    schema: z.literal(1),
    kind: z.enum(['RFI', 'RFP', 'RFQ']).default('RFI'),
    context: z.string().max(500),
    summary: z.string().trim().max(6000),
    answers: z
      .array(
        z
          .object({
            requirementId: z.uuid(),
            requirementVersion: z.iso.datetime({ offset: true }),
            text: z.string().trim().max(4000),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .refine(
    (d) => new Set(d.answers.map((a) => a.requirementId)).size === d.answers.length,
    'Each requirement may appear once.',
  );
export type ResponseDraft = z.infer<typeof responseDraftSchema>;
export type SavedResponsePackage = {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
  status: string;
};
export function readResponseDraft(content: string | null) {
  try {
    return responseDraftSchema.safeParse(JSON.parse(content ?? '')).data ?? null;
  } catch {
    return null;
  }
}
export function newResponseDraft(data: TenantData, pursuitId: string): ResponseDraft {
  return {
    schema: 1,
    kind: 'RFI',
    context: data.decisionContext ?? '',
    summary: '',
    answers: (data.requirements ?? [])
      .filter((r) => r.pursuit_id === pursuitId)
      .slice(0, 100)
      .map((r) => ({ requirementId: r.id, requirementVersion: r.updated_at, text: '' })),
  };
}
export type ResponseBlock = { kind: 'heading' | 'body' | 'note'; text: string };
export type ResponseDocument = {
  kind?: 'RFI' | 'RFP' | 'RFQ';
  title: string;
  draftName: string;
  company: string;
  buyer: string;
  solicitation: string;
  version: string;
  generatedAt: string;
  blocks: ResponseBlock[];
};

export function responseDocument(
  data: TenantData,
  pursuitId: string,
  saved: SavedResponsePackage,
  now = new Date(),
): ResponseDocument {
  const draft = readResponseDraft(saved.content);
  if (!draft || saved.status !== 'draft')
    throw new Error('This saved draft format is unavailable.');
  const pursuit = data.pursuits.find((p) => p.id === pursuitId);
  const opportunity = data.opportunities.find((o) => o.id === pursuit?.opportunity_id);
  if (!pursuit || !opportunity) throw new Error('Pursuit source is unavailable.');
  const brief = pursuitBrief(data, pursuitId);
  if (brief.partial || brief.rows.length > 100)
    throw new Error(
      'The source register exceeds this export’s limits. Reduce the package scope before exporting.',
    );
  const blocks: ResponseBlock[] = [];
  const add = (kind: ResponseBlock['kind'], text: string) => blocks.push({ kind, text });
  const issues: string[] = [];
  const contextChanged = !draft.context || draft.context !== data.decisionContext;
  if (contextChanged)
    issues.push(
      'The source or review context changed, or could not be established. Recheck every answer and evidence reference.',
    );
  add('heading', 'Response overview');
  add('body', draft.summary || '[Response overview not supplied]');
  if (!draft.summary) issues.push('Response overview is missing.');
  add(
    'note',
    `Source notice: ${opportunity.source_url ?? opportunity.source_note ?? 'Not recorded'}`,
  );
  add(
    'note',
    'Narrative answers are author drafts. Evidence-use approval applies to the cited requirement only; it does not approve this document or authorize submission.',
  );
  if (!brief.rows.length)
    issues.push(
      'No requirements are recorded. Review the entire notice before relying on this package.',
    );
  for (const [index, row] of brief.rows.entries()) {
    const r = row.requirement;
    const answer = draft.answers.find((a) => a.requirementId === r.id);
    const changed = Boolean(answer && answer.requirementVersion !== r.updated_at);
    add('heading', `${index + 1}. ${r.requirement}`);
    add('note', `Requirement ID: ${r.id}\nNotice citation: ${r.citation ?? 'Missing'}`);
    add('body', answer?.text || '[Answer not supplied]');
    if (!answer?.text) issues.push(`Requirement ${index + 1}: answer missing.`);
    if (changed) {
      add('note', 'REVIEW AGAIN: this requirement changed after the answer was drafted.');
      issues.push(`Requirement ${index + 1}: source version changed.`);
    }
    // Never copy restricted facts into a document shared with every workspace member.
    const reviews = data.evidenceReviewsEnabled
      ? (data.evidenceReviews ?? []).filter(
          (e) =>
            e.requirement_id === r.id &&
            e.approval_current === true &&
            e.proposal_use === 'approved' &&
            e.applicability === 'applicable',
        )
      : [];
    const facts = data.facts.filter(
      (f) =>
        discloseFact('viewer', f.sensitivity, f.fact_type) &&
        f.value?.trim() &&
        f.source_reference?.trim() &&
        f.verification_status === 'verified' &&
        f.verified_by &&
        f.verified_at &&
        (!f.expiration_date || f.expiration_date >= now.toISOString().slice(0, 10)) &&
        (!f.effective_date || f.effective_date <= now.toISOString().slice(0, 10)) &&
        reviews.some((e) => e.fact_id === f.id),
    );
    if (!facts.length) {
      add(
        'note',
        'No current approved workspace-visible company evidence is available for this requirement.',
      );
      issues.push(
        `Requirement ${index + 1}: no exportable current evidence. Restricted or stale evidence is not copied.`,
      );
    }
    for (const fact of facts) {
      const review = reviews.find((e) => e.fact_id === fact.id)!;
      add('body', `${fact.label}: ${fact.value}`);
      add(
        'note',
        `Company source: ${fact.source_reference}\nEvidence ${fact.id}, version ${fact.updated_at}\nRequirement-use review ${review.id}, by ${review.reviewed_by} at ${review.reviewed_at}`,
      );
    }
    for (const issue of row.issues) issues.push(`Requirement ${index + 1}: ${issue}.`);
  }
  const removed = draft.answers.filter(
    (a) => !brief.rows.some((r) => r.requirement.id === a.requirementId),
  );
  if (removed.length)
    issues.push(
      `${removed.length} saved answers refer to requirements no longer visible; those answers were omitted. Reconcile the draft.`,
    );
  add('heading', 'Internal review checklist');
  add(
    'note',
    'This section is for internal review and is included in the draft export. It is not a buyer-facing submission.',
  );
  for (const issue of issues.length
    ? issues
    : [
        'No gaps were detected in the loaded records. Source completeness and final document approval still require human review.',
      ])
    add('body', `• ${issue}`);
  add(
    'note',
    'Final document approval: not recorded. Submission: not performed. An exported file is a point-in-time working copy; later source changes do not update downloaded files.',
  );
  if (blocks.reduce((n, b) => n + b.text.length, 0) > 180000)
    throw new Error('This package is too large for one export. Reduce its scope.');
  return {
    kind: draft.kind,
    title: `${draft.kind} response — ${pursuit.title}`,
    draftName: saved.title.replace(/^RF[IPQ] response: /, ''),
    company: data.organization.legal_name || data.organization.operating_name,
    buyer: opportunity.buyer ?? 'Buyer not recorded',
    solicitation: opportunity.solicitation_number ?? 'Not recorded',
    version: `${saved.id} / ${saved.updated_at}`,
    generatedAt: now.toISOString(),
    blocks,
  };
}
