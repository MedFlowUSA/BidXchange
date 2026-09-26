import { test, expect } from '@playwright/test';
import { z } from 'zod';
import {
  planningAnswerSchema,
  type Evidence,
  type ProposedTask,
} from '../apps/web/lib/ai/contracts';
import { validateTaskProposals } from '../apps/web/lib/ai/planning';
const proposal: ProposedTask = {
  title: 'Review license evidence',
  explanation: 'Have a reviewer compare the record with the notice.',
  sources: ['requirement:r'],
  requirementKey: 'requirement:r',
};
const record = (kind: string, id: string, parent = 'p'): Evidence => ({
  citation: {
    key: `${kind}:${id}`,
    type: kind,
    id,
    title: 'Synthetic',
    sourceDate: null,
    updatedAt: null,
    status: 'needs_review',
    href: null,
  },
  fields: { workspaceRoute: `/pursuits/${parent}?organization=org` },
});
test('proposed tasks require cited evidence in the selected pursuit and cannot link arbitrary requirements', () => {
  const evidence = new Map([
    ['pursuit:p', record('pursuit', 'p')],
    ['requirement:r', record('requirement', 'r')],
    ['task:foreign', record('task', 'foreign', 'other')],
  ]);
  expect(validateTaskProposals([proposal], evidence, 'p', 'org')).toEqual([proposal]);
  for (const change of [
    { sources: ['unknown'] },
    { sources: ['task:foreign'] },
    { requirementKey: 'task:foreign' },
    { requirementKey: 'requirement:missing' },
    { sources: ['pursuit:p'], requirementKey: 'requirement:r' },
  ])
    expect(() =>
      validateTaskProposals([{ ...proposal, ...change }], evidence, 'p', 'org'),
    ).toThrow();
  expect(() => validateTaskProposals([proposal], evidence, 'p', 'other-org')).toThrow();
});
test('planning output is bounded and model fields cannot assign owners, dates or authority', () => {
  const base = { answer: [], risks: [], nextAction: '', proposedTasks: [proposal] };
  expect(planningAnswerSchema.safeParse(base).success).toBe(true);
  for (const extra of [{ owner: 'invented' }, { due_at: 'tomorrow' }, { status: 'complete' }])
    expect(
      planningAnswerSchema.safeParse({ ...base, proposedTasks: [{ ...proposal, ...extra }] })
        .success,
    ).toBe(false);
  expect(
    planningAnswerSchema.safeParse({ ...base, proposedTasks: Array(5).fill(proposal) }).success,
  ).toBe(false);
  const schema = z.toJSONSchema(planningAnswerSchema);
  expect(schema.required).toContain('proposedTasks');
  expect(schema.additionalProperties).toBe(false);
});
