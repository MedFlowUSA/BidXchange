import { test, expect } from '@playwright/test';
import { profileCompletion, recordedProfileValue } from '../apps/web/lib/profile-completion';
import { suggestedTemplate } from '../apps/web/lib/company-fields';
import { qualificationData } from './fixtures/qualification-data';

const asOf = '2026-09-22T00:00:00Z';
test('a mislabeled policy cannot count for two insurance types', () => {
  const fact = {...qualificationData().facts[0], fact_type: 'insurance', label: 'General liability insurance', structured_kind: 'insurance', structured_fields: {type: 'Commercial auto'}};
  const items = profileCompletion([fact], asOf).sections.find((s) => s.id === 'coverage')!.items;
  expect(items.find((i) => i.label === 'General liability insurance')!.completed).toBe(0);
  expect(items.find((i) => i.label === 'Commercial auto insurance')!.completed).toBe(3);
});
test('empty and unknown fields cannot inflate profile completion', () => {
  const empty = profileCompletion([], asOf);
  expect(empty.percent).toBe(0);
  expect(empty.total).toBe(60);
  expect(empty.next?.label).toBe('Legal business name');
  for (const value of ['', 'Unknown', 'TBD', '[HUMAN INPUT REQUIRED]', 'N/A', 'Not provided'])
    expect(recordedProfileValue(value)).toBe(false);
  expect(recordedProfileValue('No')).toBe(true);
});
test('field completion never attests evidence and duplicate records do not add points', () => {
  const base = qualificationData().facts[0];
  const facts = profileCompletion([], asOf).sections.flatMap((section) =>
    section.items.map((item, index) => ({
      ...base,
      id: `${section.id}-${index}`,
      label: item.label,
      fact_type: item.type,
      structured_kind: suggestedTemplate(item.type, item.label) || null,
      structured_fields: Object.fromEntries(
        item.checks.flatMap((check) =>
          check.key === 'source' || check.key === 'value' || check.key === 'expiration_date'
            ? []
            : [
                [
                  check.key.split('|')[0],
                  check.key === 'last_checked' ? '2026-09-20' : check.key === 'type' ? item.label.replace(' insurance', '') : check.key === 'program' ? 'DIR PWCR' : 'Recorded answer',
                ],
              ],
        ),
      ),
      expiration_date: '2026-09-01',
      source_reference: 'Synthetic source',
      value: 'Recorded territory',
      verification_status: 'pending_verification',
      verified_by: null,
      verified_at: null,
    })),
  );
  const before = JSON.stringify(facts);
  const complete = profileCompletion(facts, asOf);
  expect(complete.percent).toBe(100);
  expect(complete.next).toBeUndefined();
  expect(complete.sections.flatMap((s) => s.items).every((i) => i.review !== 'reviewed')).toBe(
    true,
  );
  expect(profileCompletion([...facts, ...facts], asOf).completed).toBe(complete.completed);
  expect(JSON.stringify(facts)).toBe(before);
});
test('legacy values earn only known fields and conflicting rows are not combined', () => {
  const base = qualificationData().facts[0];
  const legacy = {
    ...base,
    fact_type: 'identity',
    label: 'Legal entity',
    value: 'Synthetic LLC',
    source_reference: null,
    source_note: 'Company supplied name',
    structured_kind: null,
  };
  const item = profileCompletion([legacy], asOf).sections[0].items[0];
  expect(item.completed).toBe(2);
  expect(item.checks.filter((c) => c.recorded).map((c) => c.key)).toEqual(['legal_name', 'source']);
  const pair = [
    {
      ...legacy,
      id: 'a',
      structured_kind: 'entity',
      structured_fields: { legal_name: 'Synthetic LLC', entity_type: 'LLC' },
    },
    {
      ...legacy,
      id: 'b',
      structured_kind: 'entity',
      structured_fields: { city: 'Redlands', state: 'CA' },
    },
  ];
  expect(profileCompletion(pair, asOf).sections[0].items[0].completed).toBe(3);
});
