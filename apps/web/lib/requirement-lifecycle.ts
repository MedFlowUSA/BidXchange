import { z } from 'zod';

export const requirementLifecycleInput = z
  .object({
    organization_id: z.uuid(),
    pursuit_id: z.uuid(),
    requirement_id: z.uuid(),
    expected_source: z.iso.datetime({ offset: true }),
    operation: z.enum(['archive', 'restore', 'merge']),
    reason: z.string().trim().min(1, 'Explain why this requirement is changing.').max(2000),
    target_id: z.union([z.uuid(), z.literal('')]),
    expected_target: z.union([z.iso.datetime({ offset: true }), z.literal('')]),
    merged_text: z.string().trim().max(4000),
    acknowledged: z.literal('on', { error: 'Confirm the effect on reviews and linked records.' }),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.operation === 'merge') {
      if (!d.target_id || d.target_id === d.requirement_id || !d.expected_target || !d.merged_text)
        ctx.addIssue({
          code: 'custom',
          message: 'Choose a different target and review the combined wording.',
        });
    } else if (d.target_id || d.expected_target || d.merged_text) {
      ctx.addIssue({ code: 'custom', message: 'Target fields are only used for a merge.' });
    }
  });
