import type { TenantData } from './tenant-types';
import { workspaceHref } from './routes';
import { exportableFact } from './response-autofill';
import { readResponseDraft } from './response-package';
import { responseProgress } from './response-progress';
import { companyReadiness } from './company-readiness';
export type GuideStep = {
  id: string;
  title: string;
  detail: string;
  href: string;
  state: 'recorded' | 'next' | 'review' | 'unavailable';
  locked?: string;
};
export function hasCurrentRegisterSignoff(data: TenantData) {
  const latest = data.registerSignoffs?.[0];
  return !!latest && !!data.decisionContext && latest.context_token === data.decisionContext;
}
export function workspaceGuide(data: TenantData, pursuitId?: string): GuideStep[] {
  const href = (path: string) => workspaceHref(path, data.organization.id),
    role = data.organization.role;
  const admin = role === 'organization_admin',
    capture = ['organization_admin', 'capture_manager'].includes(role),
    executive = ['organization_admin', 'executive_approver'].includes(role);
  const pursuit = pursuitId ? data.pursuits.find((p) => p.id === pursuitId) : undefined;
  const path = pursuit ? href(`/pursuits/${pursuit.id}`) : href('/pursuits');
  const opportunity = data.opportunities.find((o) => o.id === pursuit?.opportunity_id);
  const currentDecision =
    !!data.decisionContext && data.decisions?.[0]?.context_token === data.decisionContext;
  const passed = !!pursuit && currentDecision && data.decisions?.[0]?.decision === 'no_bid';
  const requirements = (data.requirements ?? []).filter((r) => r.pursuit_id === pursuitId);
  const reviewed =
    requirements.length > 0 &&
    requirements.every((r) =>
      data.resolutions?.some(
        (h) =>
          h.requirement_id === r.id &&
          h.review_current &&
          ['supported', 'waived', 'not_applicable'].includes(h.disposition),
      ),
    );
  const saved = data.responsePackages?.[0],
    draft = saved ? readResponseDraft(saved.content) : null,
    progress = draft && pursuit ? responseProgress(draft, data, pursuit.id) : null;
  const noWritingGaps =
    !!progress &&
    !progress.overviewMissing &&
    !progress.overviewPlaceholder &&
    !progress.removed &&
    progress.rows.length > 0 &&
    progress.rows.every((r) => !r.missing && !r.placeholder && !r.changed);
  const release = data.releaseWorkflow?.versions[0];
  const scope = pursuit ? '' : 'Open a pursuit to evaluate its records. ';
  return [
    {
      id: 'organization',
      title: 'Confirm your organization',
      detail: 'Membership and workspace identity are recorded.',
      href: href('/settings'),
      state: 'recorded',
      locked: admin ? undefined : 'Only an administrator edits organization identity.',
    },
    {
      id: 'passport',
      title: 'Review the Company Passport',
      detail:
        'Verify facts, sources, dates and disclosure. Verified does not mean eligible for a particular bid.',
      href: href('/company'),
      state: data.facts.some((f) => exportableFact(f, new Date(data.reviewAsOf)))
        ? 'review'
        : 'next',
      locked: admin ? undefined : 'Ask an administrator to verify or correct company facts.',
    },
    {
      id: 'source',
      title: 'Record the official opportunity',
      detail: 'Keep the notice, solicitation number, deadline and timezone traceable.',
      href: opportunity ? href(`/opportunities/${opportunity.id}`) : href('/opportunities'),
      state: (pursuitId ? (opportunity ? [opportunity] : []) : data.opportunities).some(
        (o) =>
          o.solicitation_number &&
          (o.source_url || o.source_note) &&
          o.official_deadline &&
          o.deadline_timezone,
      )
        ? 'recorded'
        : 'next',
      locked: capture ? undefined : 'Capture manager or administrator required to edit.',
    },
    {
      id: 'pursuit',
      title: 'Open a pursuit',
      detail: 'One workspace for the response and its evidence.',
      href: path,
      state: pursuit || data.pursuits.length ? 'recorded' : 'next',
      locked: capture ? undefined : 'Capture manager or administrator required to create.',
    },
    {
      id: 'requirements',
      title: 'Record requirements and citations',
      detail: scope + 'Review the complete solicitation; excerpts may omit obligations.',
      href: path + '#pursuit-requirements',
      state: pursuit ? (requirements.length ? 'review' : 'next') : 'unavailable',
      locked: capture ? undefined : 'Capture manager or administrator required to edit.',
    },
    {
      id: 'evidence',
      title: 'Review evidence for each requirement',
      detail:
        scope +
        'Applicability, proposal use and a supported or waived finding are separate human reviews.',
      href: path + '#pursuit-requirements',
      state: pursuit ? (reviewed ? 'recorded' : 'next') : 'unavailable',
      locked: executive
        ? undefined
        : 'Administrator or executive reviewer required; waivers require executive authority.',
    },
    {
      id: 'tasks',
      title: 'Assign work and due dates',
      detail: scope + 'Give each open task an active owner and a deadline.',
      href: path + '#pursuit-tasks',
      state: pursuit
        ? data.tasks.some((t) => t.pursuit_id === pursuitId) &&
          data.tasks
            .filter((t) => t.pursuit_id === pursuitId && t.status !== 'complete')
            .every(
              (t) =>
                t.due_at &&
                data.members.some((m) => m.user_id === t.assigned_user_id && m.status === 'active'),
            )
          ? 'recorded'
          : 'next'
        : 'unavailable',
      locked: capture ? undefined : 'Capture manager or administrator required to assign work.',
    },
    {
      id: 'signoff',
      title: 'Sign off the Requirements Register',
      detail:
        scope +
        'Review the full notice, omissions and open questions before recording a final bid or no-bid decision.',
      href: path + '#register-signoff',
      state:
        !pursuit || !data.registerSignoffsEnabled
          ? 'unavailable'
          : hasCurrentRegisterSignoff(data)
            ? 'recorded'
            : 'next',
      locked: executive
        ? undefined
        : 'Ask an administrator or executive approver to sign off the register.',
    },
    {
      id: 'bid',
      title: 'Record the human bid decision',
      detail:
        scope +
        (passed
          ? 'A current no-bid decision is recorded. Preserve the reason; reopen the decision only if your team wants to reconsider.'
          : 'Record pursue or pass after register sign-off. A bid decision is not final approval or authority to submit.'),
      href: path + '#bid-decision',
      state: pursuit
        ? ['bid', 'no_bid'].includes(data.decisions?.[0]?.decision ?? '') && currentDecision
          ? 'recorded'
          : 'next'
        : 'unavailable',
      locked: executive
        ? undefined
        : 'An administrator or executive approver records the decision.',
    },
    {
      id: 'response',
      title: 'Create a response outline',
      detail:
        'Ask: “Create a response outline for this solicitation.” Complete and review its answers.',
      href: path + '#response-packages',
      state: pursuit ? (saved ? 'recorded' : 'next') : 'unavailable',
      locked: passed
        ? 'A current no-bid decision is recorded. Reconsider it before preparing a response.'
        : capture
          ? undefined
          : 'Capture manager or administrator required to save a draft.',
    },
    {
      id: 'gaps',
      title: 'Review missing and changed information',
      detail:
        scope +
        'Resolve unanswered items, placeholders and stale answers. Writing completion is not compliance.',
      href: path + '#response-packages',
      state: pursuit ? (noWritingGaps ? 'recorded' : 'next') : 'unavailable',
      locked: passed ? 'The team recorded no-bid; response work is not the next step.' : undefined,
    },
    {
      id: 'approval',
      title: 'Freeze final files and obtain approvals',
      detail:
        'Pricing → compliance → final approval → submission authorization. Review every condition.',
      href: path + '#response-release',
      state: !data.releaseWorkflow?.enabled
        ? 'unavailable'
        : !pursuit
          ? 'unavailable'
          : release?.status?.state === 'Authorized for submission'
            ? 'recorded'
            : 'next',
      locked: passed
        ? 'The team recorded no-bid; approval work is not the next step.'
        : !data.releaseWorkflow?.enabled
          ? 'Versioned approvals are not activated in this environment.'
          : executive
            ? undefined
            : 'Authorized human reviewers must approve the exact version.',
    },
    {
      id: 'submission',
      title: 'Submit manually and record the result',
      detail:
        'Use the buyer’s official channel, then record the receipt and follow-up. Exports are not submissions.',
      href: path + '#response-release',
      state:
        !data.releaseWorkflow?.enabled || !pursuit
          ? 'unavailable'
          : data.releaseWorkflow.submissions.length
            ? 'recorded'
            : 'next',
      locked: passed
        ? 'The team recorded no-bid; submission work is not the next step.'
        : !data.releaseWorkflow?.enabled
          ? 'Submission recording is not activated.'
          : release?.snapshot.checklist.submitter === data.userId
            ? undefined
            : 'Only the named authorized submitter may record submission.',
    },
  ];
}
export type NextAction = { title: string; reason: string; href: string; priority: number };
export function nextActions(
  data: TenantData,
  page: string,
  pursuitId?: string,
  opportunityId?: string,
): NextAction[] {
  const steps = workspaceGuide(data, pursuitId),
    actions: NextAction[] = [];
  const href = (path: string) => workspaceHref(path, data.organization.id);
  const now = Date.parse(data.reviewAsOf),
    capture = ['organization_admin', 'capture_manager'].includes(data.organization.role);
  if (opportunityId) {
    const opportunity = data.opportunities.find((o) => o.id === opportunityId),
      existing = data.pursuits.find((p) => p.opportunity_id === opportunityId);
    if (opportunity)
      actions.push({
        title: existing
          ? 'Open the existing pursuit'
          : 'Review source details before starting a pursuit',
        reason: existing
          ? 'Continue the saved requirements and response; do not create a duplicate.'
          : capture
            ? 'Confirm the official source, solicitation number and deadline, then create its planning workspace.'
            : 'Ask a capture manager or administrator to confirm the source and create its planning workspace.',
        href: existing ? href(`/pursuits/${existing.id}`) : href(`/opportunities/${opportunityId}`),
        priority: 1,
      });
  }
  if (page === 'Today')
    for (const opportunity of data.opportunities
      .filter((o) => o.official_deadline && Date.parse(o.official_deadline) <= now + 48 * 3600000)
      .sort((a, b) => Date.parse(a.official_deadline!) - Date.parse(b.official_deadline!))
      .slice(0, 3))
      actions.push({
        title: `Check deadline: ${opportunity.title}`,
        reason:
          'The recorded deadline is within 48 hours or has passed. Verify the buyer’s current instructions.',
        href: href(`/opportunities/${opportunity.id}`),
        priority: 0,
      });
  if (pursuitId) {
    const pursuit = data.pursuits.find((p) => p.id === pursuitId),
      opportunity = data.opportunities.find((o) => o.id === pursuit?.opportunity_id);
    if (
      opportunity?.official_deadline &&
      Date.parse(opportunity.official_deadline) - now < 48 * 3600000
    )
      actions.push({
        title: 'Check the official deadline',
        reason: 'Deadline is within 48 hours or has passed. Verify the current buyer instructions.',
        href: href(`/opportunities/${opportunity.id}`),
        priority: 0,
      });
    for (const r of data.requirements ?? []) {
      if (r.pursuit_id !== pursuitId) continue;
      const finding = data.resolutions?.find((h) => h.requirement_id === r.id);
      if (
        !finding?.review_current ||
        ['blocked', 'awaiting_clarification', 'needs_review'].includes(finding.disposition)
      )
        actions.push({
          title: 'Review requirement: ' + r.requirement,
          reason: capture
            ? 'This finding is unresolved or stale.'
            : 'Review the evidence and ask an authorized reviewer to resolve the finding.',
          href: href(`/pursuits/${pursuitId}`) + `#requirement-${r.id}`,
          priority: 1,
        });
    }
  }
  if (page === 'Today' || pursuitId) {
    for (const task of data.tasks
      .filter(
        (t) =>
          t.status !== 'complete' &&
          t.status !== 'done' &&
          (!pursuitId || t.pursuit_id === pursuitId) &&
          (capture || t.assigned_user_id === data.userId) &&
          t.due_at &&
          Date.parse(t.due_at) <= now + 86400000,
      )
      .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!)))
      actions.push({
        title: task.title,
        reason: 'Assigned work is due or overdue.',
        href: href(`/pursuits/${task.pursuit_id}`) + `#task-${task.id}`,
        priority: 2,
      });
  }
  if (page === 'Company') {
    const fact = companyReadiness(data.facts, data.reviewAsOf).needingReview[0];
    actions.push({
      title: fact ? `Review ${fact.label}` : 'Review company facts and sources',
      reason:
        'Current, sourced facts support accurate autofill; bid-specific evidence still needs review.',
      href: href('/company') + (fact ? `#fact-${fact.id}` : '#company-readiness'),
      priority: 2,
    });
  }
  for (const step of steps.filter((s) => s.state === 'next' && !s.locked))
    actions.push({ title: step.title, reason: step.detail, href: step.href, priority: 3 });
  if (!actions.length)
    actions.push({
      title: 'Review the pursuit workspace',
      reason: 'Open an authorized pursuit to inspect its current findings and response version.',
      href: href('/pursuits'),
      priority: 4,
    });
  const seen = new Set<string>();
  return actions
    .sort((a, b) => a.priority - b.priority)
    .filter((a) => {
      if (seen.has(a.href)) return false;
      seen.add(a.href);
      return true;
    })
    .slice(0, 4);
}
