import { newResponseDraft } from './response-package';
import type { TenantData } from './tenant-types';

export type ResponseKind = 'RFI' | 'RFP' | 'RFQ' | 'BID' | 'SOURCES_SOUGHT' | 'CAPABILITY';
export const responseKinds = ['RFI', 'RFP', 'RFQ', 'BID', 'SOURCES_SOUGHT', 'CAPABILITY'] as const;
export const responseKindLabels: Record<ResponseKind, string> = {
  RFI: 'RFI',
  RFP: 'RFP',
  RFQ: 'RFQ',
  BID: 'Bid',
  SOURCES_SOUGHT: 'Sources-sought',
  CAPABILITY: 'Capability-statement',
};
export const responseTitleFilter =
  'title.like.RFI response:%,title.like.RFP response:%,title.like.RFQ response:%,title.like.BID response:%,title.like.SOURCES_SOUGHT response:%,title.like.CAPABILITY response:%';
// Only explicit, standalone commands can create records. Quoted examples,
// negations, questions about drafting, and compound instructions are not actions.
export function responseCommand(prompt: string): ResponseKind | null {
  const precise = prompt
    .trim()
    .match(
      /^(?:(?:can|could|would) you\s+)?(?:please\s+)?(?:create|draft|prepare|generate|write|make)\s+(?:(?:a|an|the)\s+)?(?:(rfp|rfi|rfq|bid|sources[- ]sought|capability[- ]statement)\s+)?response(?:\s+outline)?(?:\s+for\s+(?:this|the current|the selected)\s+(?:solicitation|bid|pursuit|opportunity))?(?:\s+please)?[.!?]*$/i,
    );
  if (precise) {
    const type = precise[1]?.toLowerCase();
    return !type || type === 'bid'
      ? 'BID'
      : type.startsWith('sources')
        ? 'SOURCES_SOUGHT'
        : type.startsWith('capability')
          ? 'CAPABILITY'
          : (type.toUpperCase() as ResponseKind);
  }
  const match = prompt
    .trim()
    .match(
      /^(?:(?:can|could|would) you\s+)?(?:please\s+)?(?:create|draft|prepare|generate|write|make)\s+(?:(?:a|an|the)\s+)?(rfp|rfi|rfq)(?:\s+response)?(?:\s+draft)?(?:\s+for\s+(?:this|the current|the selected)\s+(?:bid|pursuit|opportunity))?(?:\s+please)?[.!?]*$/i,
    );
  return match ? (match[1].toUpperCase() as ResponseKind) : null;
}

export function prepareResponseDraft(data: TenantData, pursuitId: string, kind: ResponseKind) {
  const pursuit = data.pursuits.find((p) => p.id === pursuitId);
  const opportunity = data.opportunities.find((o) => o.id === pursuit?.opportunity_id);
  if (!pursuit || !opportunity) throw new Error('Open a pursuit before creating a response.');
  if (!(data.requirements ?? []).some((r) => r.pursuit_id === pursuitId))
    throw new Error(
      'Add candidate requirements from the notice before creating a response outline.',
    );
  if ((data.requirements ?? []).filter((r) => r.pursuit_id === pursuitId).length > 100)
    throw new Error('This composer supports up to 100 requirements. Review the package scope.');
  const draft = newResponseDraft(data, pursuitId);
  return {
    ...draft,
    kind,
    summary: [
      `${kind} response draft`,
      '',
      kind === 'RFP'
        ? '[Complete technical approach, delivery plan, staffing, past performance and pricing as required by the solicitation.]'
        : kind === 'RFQ'
          ? '[Complete line items, quantities, unit prices, delivery, exclusions and quote validity. Pricing requires estimator review.]'
          : '[Describe relevant capabilities, availability and requested information. Confirm each statement against approved evidence.]',
      '[Check the official instructions for required sections, attachments and submission format.]',
      ...[
        'CSLB and DIR information',
        'Bonding and insurance',
        'Relevant experience and key personnel',
        'Technical approach',
        'Schedule',
        'Safety',
        'Subcontractors',
        'Forms checklist',
        'Addendum acknowledgments',
        'Signature checklist',
        'Submission checklist',
        'Pricing',
      ].map((section) => `${section}: [HUMAN INPUT REQUIRED]`),
    ]
      .join('\n')
      .slice(0, 6000),
    // Leave answers empty so exports continue to flag every unanswered requirement.
  };
}
