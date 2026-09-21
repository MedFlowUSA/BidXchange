import { z } from 'zod';
import { readinessAreas } from './company-readiness';
import { companyTemplates, structuredErrors } from './company-fields';

export const companyRecordTypes = readinessAreas.flatMap((area) => [...area.types]) as string[];
export const workspaceRecordTypes = new Set([
  'identity',
  'license',
  'registration',
  'naics',
  'service_territory',
  'capability',
  'certification',
]);
const optionalDate = z.union([z.literal(''), z.iso.date()]);
export const companyRecordInput = z
  .object({
    organization_id: z.uuid(),
    fact_id: z.union([z.literal(''), z.uuid()]),
    updated_at: z.union([z.literal(''), z.iso.datetime({ offset: true })]),
    fact_type: z
      .string()
      .refine((value) => companyRecordTypes.includes(value), 'Choose a supported category'),
    label: z.string().trim().min(1).max(160),
    value: z.string().trim().max(4000),
    source_reference: z.string().trim().max(2000),
    source_note: z.string().trim().max(2000),
    owner_user_id: z.uuid(),
    effective_date: optionalDate,
    expiration_date: optionalDate,
    sensitivity: z.enum(['restricted', 'workspace']),
    structured_kind: z.string().max(40).optional(),
    structured_fields: z.string().max(12000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.structured_kind) {
      let fields: unknown;
      try {
        fields = JSON.parse(data.structured_fields ?? '');
      } catch {
        fields = null;
      }
      const errors = structuredErrors(data.structured_kind, fields);
      if (companyTemplates[data.structured_kind]?.type !== data.fact_type)
        errors.push('Structured record must match its category.');
      for (const message of errors)
        ctx.addIssue({ code: 'custom', message, path: ['structured_fields'] });
    } else if (data.structured_fields && data.structured_fields !== '{}') {
      ctx.addIssue({
        code: 'custom',
        message: 'Select a structured record type.',
        path: ['structured_kind'],
      });
    }
    if (Boolean(data.fact_id) !== Boolean(data.updated_at))
      ctx.addIssue({
        code: 'custom',
        message: 'Refresh the record before saving',
        path: ['updated_at'],
      });
    if (data.effective_date && data.expiration_date && data.expiration_date < data.effective_date)
      ctx.addIssue({
        code: 'custom',
        message: 'Expiration must follow the effective date',
        path: ['expiration_date'],
      });
    if (data.sensitivity === 'workspace' && !workspaceRecordTypes.has(data.fact_type))
      ctx.addIssue({
        code: 'custom',
        message: 'This category must remain restricted',
        path: ['sensitivity'],
      });
  });
