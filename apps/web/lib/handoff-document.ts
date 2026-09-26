import { z } from 'zod';
import { checklistLabels, releaseChecklist, gateLabels } from './response-release';
import type { ResponseDocument, ResponseBlock } from './response-package';
import { releaseHandoff, portalPlaybook, PLAYBOOK_VERSION } from './submission-handoff';

const text = z.string().max(10000);
const optionalText = text.nullish();
const snapshot = z.object({
  id: z.uuid(),
  sequence: z.number().int().positive(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  created_by: text,
  created_at: text,
  snapshot: z.object({
    title: text,
    checklist: releaseChecklist,
    company: z.object({ legal_name: optionalText }),
    opportunity: z.object({
      buyer: optionalText,
      solicitation: optionalText,
      deadline: optionalText,
      timezone: optionalText,
      source_url: optionalText,
    }),
    requirements: z
      .array(
        z.object({
          id: text,
          text,
          citation: optionalText,
          owner: optionalText,
          finding: optionalText,
          review_current: z.boolean().nullish(),
        }),
      )
      .max(100),
  }),
});
const approval = z.object({
  approval_type: z.enum(['pricing', 'compliance', 'final', 'submission']),
  decision: text,
  approver: text,
  decided_at: text,
  rationale: text,
  checksum: text,
});
const submission = z.object({
  submitted_by: text,
  recorded_by: text,
  submitted_at: text,
  recorded_at: text,
  details: z.object({
    method: optionalText,
    portal: optionalText,
    confirmation: optionalText,
    receipt: optionalText,
    receipt_limitation: optionalText,
    notes: optionalText,
  }),
});

export function handoffDocument(
  release: unknown,
  status: unknown,
  approvals: unknown,
  submissions: unknown,
  generatedAt = new Date().toISOString(),
): ResponseDocument {
  const v = snapshot.parse(release),
    c = v.snapshot.checklist,
    o = v.snapshot.opportunity;
  const approvalRows = z.array(approval).max(100).parse(approvals);
  const submissionRows = z.array(submission).max(100).parse(submissions);
  const readiness = releaseHandoff(c, v.checksum, status);
  const blocks: ResponseBlock[] = [];
  const add = (kind: ResponseBlock['kind'], content: string) =>
    blocks.push({ kind, text: content });
  add(
    'heading',
    readiness.ready ? 'Ready for human handoff at export time' : 'NOT READY FOR HANDOFF',
  );
  add(
    'note',
    'Internal preparation checklist only. Not a bid, buyer receipt, legal eligibility determination, or instruction to submit automatically. Reopen BidXchange before use: later amendments, evidence changes or approval revocations can invalidate this copy.',
  );
  for (const gap of readiness.gaps) add('body', `ACTION REQUIRED: ${gap}`);
  add('heading', 'Submission destination and deadline');
  add(
    'body',
    `Named submitter (workspace user ID): ${c.submitter}\nMethod: ${c.method}\nDestination: ${c.portal}\nOfficial deadline: ${o.deadline || '[HUMAN INPUT REQUIRED]'}\nTime zone: ${o.timezone || '[HUMAN INPUT REQUIRED]'}\nOfficial source: ${o.source_url || 'See reviewed notice reference'}\nReviewed source version: ${c.source_version}\nSource checked: ${c.reviewed_at}`,
  );
  add('heading', 'Packet checklist');
  for (const [key, label] of Object.entries(checklistLabels)) {
    const item = c[key as keyof typeof checklistLabels];
    add(
      'body',
      `${label}: ${item.status.replaceAll('_', ' ')}\nReference: ${item.reference || '[HUMAN INPUT REQUIRED]'}`,
    );
  }
  add('heading', 'Files to take to the official channel');
  add(
    'note',
    'Files are not embedded. Check each external file against its SHA-256 hash and the notice instructions. BidXchange does not independently verify their contents.',
  );
  for (const f of c.files)
    add('body', `${f.name}\nLocation/reference: ${f.reference}\nSHA-256: ${f.sha256}`);
  add('heading', 'Requirements in this frozen version');
  add(
    'note',
    'Findings below are historical, as of freezing. Use the current readiness warnings above. A previous reviewed finding is not a new attestation.',
  );
  for (const r of v.snapshot.requirements)
    add(
      'body',
      `${r.text}\nSource: ${r.citation || '[HUMAN INPUT REQUIRED]'}\nFinding at freeze: ${r.finding?.replaceAll('_', ' ') || 'Needs review'}; review current at freeze: ${r.review_current === true ? 'yes' : 'no'}\nOwner ID: ${r.owner || 'Unassigned'}\nRequirement record: ${r.id}`,
    );
  const playbook = portalPlaybook(`${c.method} ${c.portal}`);
  add('heading', `${playbook.name} preparation steps`);
  add(
    'note',
    `Static guidance ${PLAYBOOK_VERSION}. The issuing notice governs.${playbook.source ? ` Official help: ${playbook.source}` : ''}`,
  );
  playbook.steps.forEach((step, i) => add('body', `${i + 1}. ${step}`));
  add('heading', 'Human approval history');
  if (!approvalRows.length) add('body', 'No approval records.');
  for (const a of approvalRows)
    add(
      'body',
      `${gateLabels[a.approval_type]}: ${a.decision}\nActor ID: ${a.approver}; recorded: ${a.decided_at}\nReason: ${a.rationale}\nVersion checksum: ${a.checksum}`,
    );
  add('heading', 'User-recorded submissions');
  add(
    'note',
    'Submission information was entered by a user. BidXchange did not submit the bid and does not verify buyer receipt. A typed confirmation number is not independent proof.',
  );
  if (!submissionRows.length) add('body', 'No submission has been recorded for this version.');
  for (const s of submissionRows)
    add(
      'body',
      `Submitted by user ID: ${s.submitted_by}\nSubmitted at (user-entered): ${s.submitted_at}\nRecorded by: ${s.recorded_by}; recorded at: ${s.recorded_at}\nMethod/destination: ${s.details.method || 'Not recorded'} / ${s.details.portal || 'Not recorded'}\nConfirmation: ${s.details.confirmation || 'Not recorded'}\nReceipt reference: ${s.details.receipt || 'Not recorded'}\nReceipt limitation: ${s.details.receipt_limitation || 'Not recorded'}\nNote: ${s.details.notes || 'Not recorded'}`,
    );
  add('heading', 'Version trace');
  add(
    'body',
    `Release record: ${v.id}\nVersion: ${v.sequence}\nFrozen by user ID: ${v.created_by}\nFrozen at: ${v.created_at}\nSHA-256: ${v.checksum}`,
  );
  return {
    title: 'Submission handoff',
    draftName: `${v.snapshot.title} — version ${v.sequence}`,
    company: v.snapshot.company.legal_name || 'Company name not recorded',
    buyer: o.buyer || 'Buyer not recorded',
    solicitation: o.solicitation || '[HUMAN INPUT REQUIRED]',
    version: v.created_at,
    generatedAt,
    blocks,
  };
}
