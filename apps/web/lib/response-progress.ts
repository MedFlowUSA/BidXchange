import type { ResponseDraft } from './response-package';
import type { TenantData } from './tenant-types';

// Detect our drafting prompts and common unfinished markers, not ordinary [1]
// citations. This is a writing check, never a compliance or approval decision.
export function hasResponsePlaceholder(text: string) {
  return /\[(?:complete|confirm|describe|check|not recorded|answer not supplied|response overview not supplied|insert|add|todo|tbd)\b|\b(?:TODO|TBD)\b/i.test(
    text,
  );
}

export function responseProgress(draft: ResponseDraft, data: TenantData, pursuitId: string) {
  const requirements = (data.requirements ?? []).filter((r) => r.pursuit_id === pursuitId);
  const rows = requirements.map((r) => {
    const answer = draft.answers.find((a) => a.requirementId === r.id);
    return {
      id: r.id,
      title: r.requirement,
      missing: !answer?.text.trim(),
      placeholder: hasResponsePlaceholder(answer?.text ?? ''),
      changed: Boolean(answer && answer.requirementVersion !== r.updated_at),
    };
  });
  return {
    rows,
    current: rows.filter((r) => !r.missing && !r.placeholder && !r.changed).length,
    overviewMissing: !draft.summary.trim(),
    overviewPlaceholder: hasResponsePlaceholder(draft.summary),
    removed: draft.answers.filter((a) => !requirements.some((r) => r.id === a.requirementId))
      .length,
  };
}
