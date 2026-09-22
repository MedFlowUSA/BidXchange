import type { Fact } from './tenant-types';
import { suggestedTemplate } from './company-fields';

// Stable structured keys survive renamed labels. Generic registrations must not be
// mistaken for a specific program, and distinct bonding questions retain their scope.
export function passportRecords(facts: Fact[], suggestion: { type: string; label: string }) {
  const kind = suggestedTemplate(suggestion.type, suggestion.label);
  return facts.filter((fact) => {
    // Recognize related legacy records, without claiming completion or attestation.
    const legacy: Record<string, { types: string[]; pattern: RegExp }> = {
      'Legal business name': {
        types: ['identity'],
        pattern: /^(legal entity|legal name|operating name|dba|website)$/,
      },
      'SAM registration and UEI': {
        types: ['federal', 'registration'],
        pattern: /\b(sam|uei|cage)\b/,
      },
      'DIR public-works registration': {
        types: ['registration', 'compliance'],
        pattern: /\b(dir|pwcr)\b/,
      },
      'CSLB license and classifications': {
        types: ['license'],
        pattern: /\b(cslb|license classification)\b/,
      },
      'Service area and travel limits': { types: ['territory', 'service_territory'], pattern: /./ },
      'Procurement classification codes': {
        types: ['naics', 'psc', 'capability'],
        pattern: /\b(naics|psc|nigp|unspsc|classification codes)\b/,
      },
    };
    const alias = legacy[suggestion.label];
    if (
      alias?.types.includes(fact.fact_type) &&
      alias.pattern.test(fact.label.trim().toLowerCase())
    )
      return true;
    if (fact.fact_type !== suggestion.type) return false;
    if (fact.label.trim().toLowerCase() === suggestion.label.toLowerCase()) return true;
    if (!kind || kind === 'registration' || fact.structured_kind !== kind) return false;
    const fields = fact.structured_fields ?? {};
    if (
      [
        'General liability insurance',
        'Workers’ compensation insurance',
        'Commercial auto insurance',
      ].includes(suggestion.label)
    )
      return (
        fields.type?.trim().toLowerCase() ===
        suggestion.label.replace(' insurance', '').toLowerCase()
      );
    if (/^Past project [123]$/.test(suggestion.label)) return false;
    if (suggestion.label === 'Single-project bonding limit') return !!fields.single_limit?.trim();
    if (suggestion.label === 'Aggregate bonding capacity') return !!fields.aggregate_limit?.trim();
    return Object.values(fields).some((value) => value.trim());
  });
}
