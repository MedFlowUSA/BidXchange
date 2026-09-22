import { californiaPassportSteps } from './california-passport';
import { companyTemplates, suggestedTemplate } from './company-fields';
import { passportRecords } from './passport-records';
import { reviewStatus, daysUntilExpiration } from './company-readiness';
import type { Fact } from './tenant-types';

// Versioned field-entry checklist, deliberately independent of eligibility and attestation.
export const profileChecklistVersion = 'california-level-1-v1';
const fields: Record<string, string[]> = {
  'Legal business name': ['legal_name', 'entity_type', 'city', 'state'],
  'SAM registration and UEI': ['uei', 'sam_status', 'last_checked'],
  'DIR public-works registration': ['program', 'identifier', 'status', 'last_checked'],
  'CSLB license and classifications': ['number', 'classification', 'expiration_date'],
  'Service area and travel limits': ['value'],
  'Procurement classification codes': ['naics', 'scope'],
  'Bonding bands and bid-bond capability': [
    'single_band|single_limit',
    'aggregate_band|aggregate_limit',
    'bid_bond',
  ],
  'General liability insurance': ['type', 'expiration_date'],
  'Workers’ compensation insurance': ['type', 'expiration_date'],
  'Commercial auto insurance': ['type', 'expiration_date'],
};
const projectFields = [
  'client',
  'role',
  'value_band|value',
  'year',
  'scope',
  'location',
  'permission',
];
export function recordedProfileValue(value: string | null | undefined) {
  return Boolean(
    value?.trim() &&
    !/^(unknown|not known|not provided|not recorded|not available|tbd|tbc|pending|n\/?a|none|[-?]+|\[.*\])$/i.test(
      value.trim(),
    ),
  );
}
function value(fact: Fact, key: string) {
  if (key === 'source') return fact.source_reference || fact.source_note;
  if (key === 'expiration_date') return fact.expiration_date;
  if (key === 'value') return fact.value;
  if (fact.structured_fields?.[key]) return fact.structured_fields[key];
  const legacyLabels: Record<string, RegExp> = {
    legal_name: /^(legal entity|legal name|legal business name)$/i,
    uei: /^uei$/i,
    number: /^cslb license number$/i,
    classification: /^(cslb )?license classifications?$/i,
    naics: /^(primary |secondary )?naics$/i,
  };
  return !fact.structured_kind && legacyLabels[key]?.test(fact.label.trim())
    ? fact.value
    : undefined;
}
export function profileCompletion(facts: Fact[], asOf: string) {
  const sections = californiaPassportSteps.map((step) => {
    const items = step.items.map((item) => {
      const kind = suggestedTemplate(item.type, item.label);
      const keys = [...(fields[item.label] ?? projectFields), 'source'];
      const related = passportRecords(facts, item).filter((fact) => {
        const details = fact.structured_fields;
        if (item.type === 'insurance' && details?.type?.trim())
          return details.type.trim().toLowerCase().replaceAll("'", '’') === item.label.replace(' insurance', '').toLowerCase();
        if (item.label === 'DIR public-works registration' && details?.program?.trim())
          return /\b(dir|pwcr)\b|public[- ]works/i.test(details.program);
        return true;
      });
      const structured = related.filter((fact) => kind && fact.structured_kind === kind);
      const candidates = structured.length
        ? structured
        : related.filter((fact) => !kind || !fact.structured_kind || fact.structured_kind === kind);
      const present = (fact: Fact, key: string) =>
        key.split('|').some((part) => {
          const answer = value(fact, part);
          return (
            recordedProfileValue(answer) &&
            (!['expiration_date', 'last_checked'].includes(part) ||
              daysUntilExpiration(answer ?? null, asOf) !== null)
          );
        });
      // Do not combine contradictory or unrelated rows into a fictitious complete record.
      const best = [...candidates].sort(
        (a, b) =>
          keys.filter((k) => present(b, k)).length - keys.filter((k) => present(a, k)).length ||
          a.id.localeCompare(b.id),
      )[0];
      const checks = keys.map((key) => ({
        key,
        label:
          key === 'source'
            ? 'Source reference or note'
            : key === 'value'
              ? 'Counties, cities or travel limits'
              : key === 'expiration_date'
                ? 'Expiration date'
                : key
                    .split('|')
                    .map(
                      (k) =>
                        companyTemplates[kind ?? '']?.fields.find((f) => f.key === k)?.label ?? k,
                    )
                    .join(' or '),
        recorded: Boolean(best && present(best, key)),
      }));
      const completed = checks.filter((c) => c.recorded).length;
      return {
        ...item,
        checks,
        completed,
        total: checks.length,
        factId: best?.fact_type === item.type ? best.id : undefined,
        legacy: Boolean(best && kind && !best.structured_kind),
        review: best ? reviewStatus(best, asOf) : null,
      };
    });
    return {
      id: step.id,
      title: step.question,
      items,
      completed: items.reduce((n, i) => n + i.completed, 0),
      total: items.reduce((n, i) => n + i.total, 0),
    };
  });
  const completed = sections.reduce((n, s) => n + s.completed, 0);
  const total = sections.reduce((n, s) => n + s.total, 0);
  const percent = Math.floor((completed * 100) / total);
  const next = sections
    .flatMap((s) => s.items.map((item) => ({ section: s.id, ...item })))
    .find((i) => i.completed < i.total);
  return { sections, completed, total, percent, next };
}
