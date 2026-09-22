import { test, expect } from '@playwright/test';
import { releaseActionInput } from '../apps/web/lib/response-release';
import { outcomeNote } from '../apps/web/lib/outcome-note';

const base = {
  action: 'followup',
  organization: '11111111-1111-4111-8111-111111111111',
  release: '22222222-2222-4222-8222-222222222222',
  event: 'award',
  note: 'Fictional buyer notice.',
  due: '',
};
const outcome = {
  date: '2026-09-22',
  source: 'Fictional notice 12',
  awardee: 'Fictional contractor',
  amount: '850000 USD',
  reason: 'Buyer recorded award',
  debrief: '',
  disclosure: 'not_granted' as const,
};
test('outcomes retain provenance, unknowns and no automatic reuse in existing history', () => {
  expect(releaseActionInput.safeParse({ ...base, outcome }).success).toBe(true);
  const note = outcomeNote(base.note, outcome);
  expect(note).toContain('Official source / reference: Fictional notice 12');
  expect(note).toContain('Permission to disclose: Not granted');
  expect(note).toContain('No automatic past-performance claim or reuse.');
  expect(outcomeNote(base.note, { ...outcome, amount: '' })).toContain(
    'Official award amount: Not recorded',
  );
  expect(releaseActionInput.safeParse(base).success).toBe(true);
  expect(outcomeNote('Existing follow-up')).toBe('Existing follow-up');
});
test('reject missing provenance, invented amount formats, wrong event and invalid disclosure', () => {
  for (const change of [
    { source: '' },
    { date: 'unknown' },
    { amount: 'about a million' },
    { reason: '' },
  ])
    expect(
      releaseActionInput.safeParse({ ...base, outcome: { ...outcome, ...change } }).success,
    ).toBe(false);
  expect(releaseActionInput.safeParse({ ...base, event: 'clarification', outcome }).success).toBe(
    false,
  );
  expect(
    releaseActionInput.safeParse({
      ...base,
      event: 'loss',
      outcome: { ...outcome, disclosure: 'granted' },
    }).success,
  ).toBe(false);
  expect(releaseActionInput.safeParse({ ...base, note: 'x'.repeat(1900), outcome }).success).toBe(
    false,
  );
});
