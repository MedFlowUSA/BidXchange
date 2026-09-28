import type { TenantData } from './tenant-types';
import type { Role } from './ai/contracts';
import { discloseFact, effectiveStatus, displayDate } from './ai/policy';
import { pursuitBrief } from './pursuit-brief';
import { readResponseDraft, type ResponseDocument, type ResponseBlock } from './response-package';
import { hasResponsePlaceholder } from './response-progress';
import { resolutionLabels } from './requirement-resolution';
import { hasCurrentRegisterSignoff } from './workspace-guide';
import { gateLabels } from './response-release';
import { detailFields } from './sources/normalized';
import { findSource } from './sources/registry';

export class BidReportError extends Error {}
export const canIncludeRestricted = (role: string) =>
  ['organization_admin', 'executive_approver', 'estimator'].includes(role);
export type BidReportSelection = { packageId?: string; version?: string; restricted?: boolean };
const shown = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : 'Not recorded';
const words = (value: string) => value.replaceAll('_', ' ');

export function bidReport(
  data: TenantData,
  pursuitId: string,
  selection: BidReportSelection = {},
  now = new Date(),
): ResponseDocument {
  const pursuit = data.pursuits.find((p) => p.id === pursuitId);
  const opportunity = data.opportunities.find((o) => o.id === pursuit?.opportunity_id);
  if (!pursuit || !opportunity) throw new BidReportError('This bid is unavailable.');
  if (selection.restricted && !canIncludeRestricted(data.organization.role))
    throw new BidReportError('Your role cannot include restricted company records.');
  const brief = pursuitBrief(data, pursuitId);
  const tasks = data.tasks
    .filter((t) => t.pursuit_id === pursuitId)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (
    brief.partial ||
    brief.rows.length > 100 ||
    data.facts.length >= 500 ||
    tasks.length >= 500 ||
    (data.amendments?.length ?? 0) >= 100 ||
    data.releaseWorkflow?.partial
  )
    throw new BidReportError(
      'This bid exceeds the report limits or has an incomplete source set. No partial PDF was generated.',
    );
  const saved = selection.packageId
    ? data.responsePackages?.find((p) => p.id === selection.packageId)
    : undefined;
  if (selection.packageId && (!saved || saved.updated_at !== selection.version))
    throw new BidReportError(
      'The selected answer draft changed or is unavailable. Reload before exporting.',
    );
  const draft = saved ? readResponseDraft(saved.content) : null;
  if (saved && (!draft || saved.status !== 'draft'))
    throw new BidReportError('Choose a supported saved response draft.');
  const contextCurrent = !!draft?.context && draft.context === data.decisionContext;
  const facts = data.facts
    .filter((f) =>
      discloseFact(
        (selection.restricted ? data.organization.role : 'viewer') as Role,
        f.sensitivity,
        f.fact_type,
      ),
    )
    .sort(
      (a, b) =>
        a.fact_type.localeCompare(b.fact_type) ||
        a.label.localeCompare(b.label) ||
        a.id.localeCompare(b.id),
    );
  const factIds = new Set(facts.map((f) => f.id));
  const blocks: ResponseBlock[] = [];
  const add = (kind: ResponseBlock['kind'], text: string) => blocks.push({ kind, text });
  const answerFor = (id: string) => draft?.answers.find((a) => a.requirementId === id);
  const answered = brief.rows.filter(({ requirement: r }) => {
    const a = answerFor(r.id);
    return (
      a?.text.trim() &&
      !hasResponsePlaceholder(a.text) &&
      a.requirementVersion === r.updated_at &&
      contextCurrent
    );
  }).length;
  add('heading', 'Bid review at a glance');
  add(
    'note',
    'CONFIDENTIAL INTERNAL REPORT. Saved records and human findings only. This report does not determine legal eligibility, certify compliance, approve answers or submit a bid. Missing information is not completed automatically. Review before sharing.',
  );
  add(
    'body',
    `Active requirements: ${brief.rows.length}\nCurrent human findings marked supported, waived or not applicable: ${brief.rows.filter((r) => r.resolved).length}\nBlockers: ${brief.rows.filter((r) => r.blocked).length}\nDraft answers present without detected placeholders and matching the current source context: ${answered}\nOther requirements needing an answer or answer review: ${brief.rows.length - answered}\nOpen tasks: ${tasks.filter((t) => !['complete', 'completed', 'cancelled'].includes(t.status)).length}`,
  );
  add(
    'note',
    'These counts describe saved work, not legal qualification or response quality. A drafted answer is separate from a human requirement finding. No requirement register is assumed complete.',
  );
  if (!brief.rows.length)
    add(
      'body',
      'ACTION REQUIRED: No requirements are recorded. Review the entire solicitation and build the register.',
    );
  add('heading', 'Company identity and records');
  add(
    'body',
    `Workspace legal name: ${shown(data.organization.legal_name)}\nOperating name: ${shown(data.organization.operating_name)}\nWebsite: ${shown(data.organization.website)}\nOrganization record: ${data.organization.id}`,
  );
  if (data.companyProfile?.summary) {
    add('body', `Saved company description (not an attestation):\n${data.companyProfile.summary}`);
    add(
      'note',
      `Company profile ${data.companyProfile.id}; updated ${data.companyProfile.updated_at}`,
    );
  }
  add(
    'note',
    `Company records below are saved claims, including unreviewed or expired items labeled individually. Their presence does not authorize proposal reuse. ${selection.restricted ? 'Restricted records permitted by the exporter’s role are included. Treat this copy as confidential.' : 'Restricted and unclassified company records are excluded. Their absence is not evidence that the company lacks the qualification.'} External documents are referenced, not embedded. Unknown or unavailable records are never inferred.`,
  );
  if (!facts.length)
    add(
      'body',
      'No company records are available for this report’s disclosure level. Add and review company evidence in Company profile.',
    );
  for (const f of facts) {
    const status = effectiveStatus({ ...f, last_checked: f.structured_fields?.last_checked }, now);
    add('heading', `${words(f.fact_type)} — ${f.label}`);
    add(
      'body',
      `${shown(f.value)}\nRecord status: ${words(status)}\nEffective: ${shown(f.effective_date)}; expires: ${shown(f.expiration_date)}\nSource last checked: ${shown(f.structured_fields?.last_checked || f.verified_at)}\nHuman attestation: ${shown(f.verified_by)} at ${shown(f.verified_at)}`,
    );
    add(
      'note',
      `Source: ${shown(f.source_reference)}\nSource note: ${shown(f.source_note)}\nRecord ${f.id}; updated ${f.updated_at}; visibility ${f.sensitivity}`,
    );
  }
  add('heading', 'Bid information');
  const details = opportunity.source_details;
  add(
    'body',
    `Bid: ${pursuit.title}\nNotice: ${opportunity.title}\nBuyer: ${shown(opportunity.buyer)}\nSolicitation: ${shown(opportunity.solicitation_number)}\nDeadline: ${displayDate(opportunity.official_deadline, opportunity.deadline_timezone)}\nDeadline time zone: ${shown(opportunity.deadline_timezone)}\nPlace of performance: ${shown(details?.place)}\nEstimated value as recorded: ${opportunity.estimated_value == null ? 'Not stated' : String(opportunity.estimated_value)}\nStage: ${words(pursuit.status)}\nScope / notice summary:\n${shown(opportunity.summary)}`,
  );
  add(
    'note',
    `Official source: ${shown(opportunity.source_url)}\nSource note: ${shown(opportunity.source_note)}\nOpportunity record: ${opportunity.id}; updated ${shown(opportunity.updated_at)}\nPursuit record: ${pursuit.id}; updated ${shown(pursuit.updated_at)}`,
  );
  add('heading', 'Recorded notice criteria, meetings and submission instructions');
  if (!details)
    add(
      'body',
      'Structured source details are not recorded. Confirm buyer instructions, required qualifications, meetings and the submission destination from the official notice.',
    );
  else {
    add(
      'body',
      `Source portal: ${findSource(details.sourceId)?.name ?? details.sourceId}\nSubmission destination: ${shown(details.submissionUrl)}`,
    );
    for (const [key, label] of Object.entries(detailFields))
      add('body', `${label}: ${shown(details[key as keyof typeof detailFields])}`);
    for (const [label, date] of [
      ['Published', details.publishedAt],
      ['Questions due', details.questionDeadline],
      ['Site visit / job walk', details.siteVisit],
      ['Pre-bid meeting', details.preBidMeeting],
    ])
      add('body', `${label}: ${displayDate(date, opportunity.deadline_timezone)}`);
    add(
      'note',
      'Recorded source details are manual entries, not a live portal check. Blank fields mean unknown, not “not required.” Compare them with the latest notice and amendments.',
    );
  }
  add('heading', 'Selected response draft');
  add(
    'body',
    saved
      ? `${saved.title}\nSaved draft ${saved.id}; version ${saved.updated_at}\nOverview:\n${draft?.summary || '[HUMAN INPUT REQUIRED: response overview]'}`
      : 'No answer draft selected. Requirement findings are still included; narrative answers are not invented. Create and save a response draft to include answers.',
  );
  if (draft && !contextCurrent)
    add(
      'body',
      'REVIEW AGAIN: The selected draft’s source context changed or cannot be established. Its answers require review.',
    );
  add('heading', 'Requirement-by-requirement review and answers');
  for (const [i, row] of brief.rows.entries()) {
    const r = row.requirement,
      resolution = row.resolution,
      answer = answerFor(r.id);
    add('heading', `${i + 1}. ${r.requirement}`);
    add(
      'note',
      `Requirement ${r.id}; version ${r.updated_at}\nSource quotation / location: ${shown(r.citation)}\nAssigned reviewer: ${shown(r.owner_user_id)}`,
    );
    add(
      'body',
      `Human finding: ${resolution ? resolutionLabels[resolution.disposition] : 'Not reviewed'}\nFinding current: ${resolution?.review_current === true ? 'Yes, as reported by the workspace at export time' : 'No — human review required'}\nSaved follow-up state: ${words(r.status)}`,
    );
    if (resolution)
      add(
        'body',
        `Review reason: ${shown(resolution.reason)}\nReviewed by ${resolution.reviewed_by} at ${resolution.reviewed_at}\nAuthority / waiver: ${shown(resolution.authority_name)}\nAuthority reference: ${shown(resolution.authority_reference)}`,
      );
    add(
      'body',
      `Saved draft answer:\n${answer?.text || '[HUMAN INPUT REQUIRED: no saved answer]'}`,
    );
    if (answer && (!contextCurrent || answer.requirementVersion !== r.updated_at))
      add(
        'note',
        'REVIEW AGAIN: This answer does not match the current requirement/source version.',
      );
    if (answer && hasResponsePlaceholder(answer.text))
      add('note', 'INCOMPLETE ANSWER: Human-input placeholders remain.');
    row.issues.forEach((issue) => add('note', `ACTION REQUIRED: ${issue}.`));
    const links = data.evidenceReviewsEnabled
      ? (data.evidenceReviews ?? []).filter(
          (e) => e.requirement_id === r.id && factIds.has(e.fact_id),
        )
      : [];
    if (!links.length)
      add(
        'note',
        'No linked evidence is available at this report’s disclosure level. Review the requirement in the workspace.',
      );
    for (const e of links) {
      const f = facts.find((v) => v.id === e.fact_id)!;
      add(
        'body',
        `Linked evidence: ${f.label} (record ${f.id})\nRequirement use: ${words(e.proposal_use)}; applicability: ${words(e.applicability)}\nEvidence-use approval current: ${e.approval_current === true ? 'Yes' : 'No — review required'}\nEvidence record status: ${words(effectiveStatus({ ...f, last_checked: f.structured_fields?.last_checked }, now))}\nReview reason: ${shown(e.reason)}\nReviewed by ${e.reviewed_by} at ${e.reviewed_at}; review ${e.id}`,
      );
    }
  }
  const removed =
    draft?.answers.filter((a) => !brief.rows.some((r) => r.requirement.id === a.requirementId))
      .length ?? 0;
  if (removed)
    add(
      'note',
      `${removed} saved answers refer to requirements no longer active or visible and were omitted. Reconcile the draft.`,
    );
  add('heading', 'Register sign-off and bid decision');
  const signoff = data.registerSignoffsEnabled ? data.registerSignoffs?.[0] : undefined;
  add(
    'body',
    `Register sign-off: ${signoff && hasCurrentRegisterSignoff(data) ? 'Current recorded human sign-off' : 'Needs human sign-off or reaffirmation'}`,
  );
  if (signoff)
    add(
      'body',
      `Last sign-off: ${signoff.signed_off_by} at ${signoff.signed_off_at}\nNote: ${shown(signoff.note)}\nSign-off record: ${signoff.id}`,
    );
  const decision = data.decisionsEnabled ? data.decisions?.[0] : undefined;
  add(
    'body',
    decision
      ? `Latest recorded decision: ${words(decision.preliminary_state || decision.decision)}\nDecision context: ${!!data.decisionContext && decision.context_token === data.decisionContext ? 'Current saved context' : 'STALE — human reaffirmation required'}\nReason: ${shown(decision.reason)}\nConditions: ${shown(decision.conditions)}\nReason codes: ${(decision.reason_codes ?? []).map(words).join(', ') || 'Not recorded'}\nEstimated pursuit hours (user-entered): ${decision.estimated_pursuit_hours ?? 'Not recorded'}\nRecorded by ${decision.decided_by} at ${decision.decided_at}; record ${decision.id}`
      : 'No bid/no-bid decision history is available. A report does not make this decision.',
  );
  add('heading', 'Tasks and remaining work');
  if (!tasks.length)
    add('body', 'No tasks recorded. Assign an owner and deadline to each open item.');
  for (const t of tasks)
    add(
      'body',
      `${t.title}\nStatus: ${words(t.status)}; priority: ${shown(t.priority)}\nOwner: ${shown(t.assigned_user_id)}\nDue: ${displayDate(t.due_at, t.due_timezone ?? data.organization.default_timezone)}; time zone: ${shown(t.due_timezone ?? data.organization.default_timezone)}\nCompleted at: ${shown(t.completed_at)}\nLinked requirement: ${shown(t.requirement_id)}\nNotes: ${shown(t.notes)}\nTask ${t.id}; updated ${shown(t.updated_at)}`,
    );
  add('heading', 'Recorded amendments');
  if (!data.amendments?.length)
    add(
      'body',
      'No amendments are available in the workspace. Check the official source; this does not establish that no amendments exist.',
    );
  for (const a of data.amendments ?? [])
    add(
      'body',
      `${a.label} — issued ${shown(a.issued_on)}\n${a.summary}\nSource: ${a.source_url}\nReview acknowledged: ${a.reviewed ? 'Yes' : 'No — review needed'}; by ${shown(a.reviewed_by)} at ${shown(a.reviewed_at)}\nAmendment ${a.id}; updated ${a.updated_at}`,
    );
  add('heading', 'Latest frozen response and user-recorded submission');
  const workflow = data.releaseWorkflow,
    release = workflow?.enabled ? workflow.versions[0] : undefined;
  if (!release)
    add(
      'body',
      'No frozen response version is available. Exporting this report neither approves a response nor records submission.',
    );
  else {
    add(
      'body',
      `Frozen version ${release.sequence}: ${release.id}\nCreated by ${release.created_by} at ${release.created_at}\nSource draft: ${release.package_id} / ${release.package_version}\nCurrent release: ${release.status?.current === true ? 'Yes at export time' : 'No or unavailable — review required'}\nChecksum: ${release.checksum}`,
    );
    for (const [key, label] of Object.entries(gateLabels))
      add(
        'body',
        `${label}: ${release.status?.approvals[key] === true ? 'Current recorded approval' : 'Missing or no longer current'}`,
      );
    const submission = workflow!.submissions
      .filter((s) => s.release_id === release.id)
      .sort((a, b) => b.sequence - a.sequence)[0];
    add(
      'body',
      submission
        ? `Latest submission entry for this version: ${submission.kind}\nNamed submitter: ${submission.submitted_by}\nSubmitted at (user-entered): ${submission.submitted_at}\nRecorded by ${submission.recorded_by} at ${submission.recorded_at}\nDestination: ${shown(submission.details.portal)}\nConfirmation: ${shown(submission.details.confirmation)}`
        : 'No submission entry is available for this version.',
    );
  }
  add(
    'note',
    'Submission information was recorded by a user and was not independently verified by BidXchange. BidXchange did not submit the bid. This report includes the latest loaded decision, sign-off and release, not a complete historical audit. Downloaded copies do not update after amendments, evidence changes or revoked approvals.',
  );
  if (blocks.reduce((n, b) => n + b.text.length, 0) > 180000)
    throw new BidReportError('This report is too large for one PDF. No partial PDF was generated.');
  return {
    title: `Bid Report — ${pursuit.title}`,
    draftName: 'Company information, requirements, saved answers and remaining work',
    company: data.organization.legal_name || data.organization.operating_name,
    buyer: shown(opportunity.buyer),
    solicitation: shown(opportunity.solicitation_number),
    version: `${pursuitId}${saved ? ` / answer draft ${saved.id} / ${saved.updated_at}` : ' / no answer draft selected'}`,
    generatedAt: now.toISOString(),
    blocks,
  };
}
