import type { TenantData } from './tenant-types';
import { pursuitBrief } from './pursuit-brief';
import { reviewStatus, daysUntilExpiration } from './company-readiness';
import { readResponseDraft } from './response-package';
import { hasResponsePlaceholder } from './response-progress';

// Read-only projection of an authorized pursuit snapshot. Never infers legal eligibility,
// partner suitability or claim support from keywords or the presence of a company fact.
export function qualificationMap(data: TenantData, pursuitId: string) {
  const pursuit = data.pursuits.find((p) => p.id === pursuitId);
  const opportunity = data.opportunities.find((o) => o.id === pursuit?.opportunity_id);
  const deadline = opportunity?.official_deadline;
  let deadlineDay: string | null = null;
  if (deadline && Number.isFinite(Date.parse(deadline))) {
    try {
      deadlineDay = new Intl.DateTimeFormat('en-CA', {
        timeZone: opportunity!.deadline_timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(deadline));
    } catch {
      /* Unknown time zone means unknown expiration comparison. */
    }
  }
  const brief = pursuitBrief(data, pursuitId);
  const facts = new Map(data.facts.slice(0, 500).map((fact) => [fact.id, fact]));
  const drafts = (data.responsePackages ?? []).slice(0, 20).map((saved) => ({
    saved,
    draft: readResponseDraft(saved.content),
  }));
  let hiddenEvidence = false;
  const rows = brief.rows
    .map((row) => {
      const reviews = data.evidenceReviewsEnabled
        ? (data.evidenceReviews ?? [])
            .slice(0, 500)
            .filter((r) => r.requirement_id === row.requirement.id)
        : [];
      const evidence = [...new Set(reviews.map((r) => r.fact_id))].flatMap((id) => {
        const fact = facts.get(id);
        if (!fact) {
          hiddenEvidence = true;
          return [];
        }
        const links = reviews.filter((r) => r.fact_id === id);
        const status = reviewStatus(fact, data.reviewAsOf);
        const approved = links.some(
          (r) =>
            r.approval_current === true &&
            r.proposal_use === 'approved' &&
            r.applicability === 'applicable',
        );
        const needsRenewal =
          !!deadlineDay &&
          fact.expiration_date !== null &&
          (daysUntilExpiration(fact.expiration_date, deadlineDay) ?? Infinity) <= 0;
        return [
          {
            fact,
            status,
            approved,
            needsRenewal,
            current: approved && ['reviewed', 'expiring'].includes(status),
          },
        ];
      });
      const answers = drafts.flatMap(({ saved, draft }) => {
        const answer = draft?.answers.find((a) => a.requirementId === row.requirement.id);
        if (!answer) return [];
        return [
          {
            id: saved.id,
            title: saved.title,
            sourceChanged: answer.requirementVersion !== row.requirement.updated_at,
            contextChanged: !draft!.context || draft!.context !== data.decisionContext,
            unfinished: !answer.text.trim() || hasResponsePlaceholder(answer.text),
          },
        ];
      });
      const actions: { kind: string; title: string; detail: string }[] = [];
      const add = (kind: string, title: string, detail: string) =>
        actions.push({ kind, title, detail });
      if (row.blocked)
        add(
          'blocker',
          'Resolve the recorded blocker',
          'Ask the requirement owner whether a correction, buyer clarification or permitted teaming arrangement is feasible. No cure or partner eligibility has been established.',
        );
      if (!row.requirement.citation?.trim())
        add(
          'citation',
          'Locate the controlling notice language',
          'Record the section or addendum before interpreting this requirement.',
        );
      if (!row.requirement.owner_user_id)
        add(
          'owner',
          'Assign a requirement owner',
          'Choose an active workspace member to own the review.',
        );
      if (evidence.some((e) => e.needsRenewal))
        add(
          'renewal',
          'Confirm coverage through the submission deadline',
          'Linked evidence expires on or before the deadline date. Obtain updated evidence and renew the requirement-specific approval. An alternative record must be reviewed for scope.',
        );
      if (evidence.some((e) => !e.current))
        add(
          'evidence',
          'Review the linked evidence',
          'Some linked records are unverified, expired, rejected, not yet effective or lack current proposal-use approval. A saved link alone does not support this requirement.',
        );
      if (!row.resolved)
        add(
          'review',
          row.resolution?.disposition === 'awaiting_clarification'
            ? 'Obtain the buyer clarification'
            : 'Record a current requirement finding',
          'An authorized reviewer must compare the requirement with current evidence. Missing or inaccessible evidence means unknown, not automatically failed.',
        );
      if (answers.some((a) => a.sourceChanged || a.contextChanged || a.unfinished))
        add(
          'response',
          'Recheck the affected response sections',
          'A saved section is unfinished or its source/review context changed. Revise it and repeat the applicable review.',
        );
      const priority = row.blocked
        ? 0
        : actions.some((a) => a.kind === 'renewal')
          ? 1
          : !row.resolved
            ? 2
            : actions.length
              ? 3
              : 4;
      return { ...row, evidence, answers, actions, priority };
    })
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        b.actions.length - a.actions.length ||
        a.requirement.id.localeCompare(b.requirement.id),
    );
  const dependencies = [...facts.values()]
    .flatMap((fact) => {
      const linked = rows.filter((row) => row.evidence.some((e) => e.fact.id === fact.id));
      if (!linked.length) return [];
      return [
        {
          fact,
          requirements: linked.map((r) => r.requirement.id),
          needsAttention: linked.some((r) =>
            r.evidence.some((e) => e.fact.id === fact.id && (!e.current || e.needsRenewal)),
          ),
          responseCount: new Set(linked.flatMap((r) => r.answers.map((a) => a.id))).size,
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.needsAttention) - Number(a.needsAttention) ||
        b.requirements.length - a.requirements.length ||
        a.fact.id.localeCompare(b.fact.id),
    );
  return {
    rows,
    dependencies,
    opportunity,
    hiddenEvidence,
    deadlineDay,
    deadlinePassed: !!deadline && Date.parse(deadline) < Date.parse(data.reviewAsOf),
    blocked: rows.filter((r) => r.blocked).length,
    needingAction: rows.filter((r) => r.actions.length).length,
    partial: brief.partial || data.facts.length >= 500 || (data.responsePackages?.length ?? 0) > 20,
    unavailable: !data.evidenceReviewsEnabled || !data.resolutionsEnabled,
    unreadableDrafts: drafts.some((d) => !d.draft),
  };
}
