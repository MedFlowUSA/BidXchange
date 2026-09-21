import type { Fact } from './tenant-types';
import { suggestedTemplate } from './company-fields';

// Stable structured keys survive renamed labels. Generic registrations must not be
// mistaken for a specific program, and distinct bonding questions retain their scope.
export function passportRecords(facts: Fact[], suggestion: { type: string; label: string }) {
  const kind = suggestedTemplate(suggestion.type, suggestion.label);
  return facts.filter((fact) => {
    if (fact.fact_type !== suggestion.type) return false;
    if (fact.label.trim().toLowerCase() === suggestion.label.toLowerCase()) return true;
    if (!kind || kind === 'registration' || fact.structured_kind !== kind) return false;
    const fields = fact.structured_fields ?? {};
    if (suggestion.label === 'Single-project bonding limit') return !!fields.single_limit?.trim();
    if (suggestion.label === 'Aggregate bonding capacity') return !!fields.aggregate_limit?.trim();
    return Object.values(fields).some((value) => value.trim());
  });
}
