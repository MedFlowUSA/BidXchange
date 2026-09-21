import type { TenantData } from './tenant-types';
import type { ResponseDraft } from './response-package';
import { responseProgress } from './response-progress';
import { pursuitBrief } from './pursuit-brief';

// A review index over already-authorized records, never a compliance score.
export function responseCoverage(data: TenantData, pursuitId: string, draft: ResponseDraft) {
  const brief = pursuitBrief(data, pursuitId);
  const progress = responseProgress(draft, data, pursuitId);
  const contextChanged = !draft.context || draft.context !== data.decisionContext;
  const rows = brief.rows.map((row) => {
    const writing = progress.rows.find((r) => r.id === row.requirement.id)!;
    const issues = [
      ...(writing.missing ? ['Answer missing'] : []),
      ...(writing.placeholder ? ['Unfinished answer placeholders'] : []),
      ...(writing.changed ? ['Requirement changed after drafting'] : []),
      ...row.issues,
    ];
    return {
      ...row,
      answer: draft.answers.find((a) => a.requirementId === row.requirement.id)?.text ?? '',
      issues,
      needsAttention: contextChanged || issues.length > 0,
    };
  });
  return { rows, partial: brief.partial, contextChanged };
}
