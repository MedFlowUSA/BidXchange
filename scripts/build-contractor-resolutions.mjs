import { readFileSync, writeFileSync } from 'node:fs';
const original = readFileSync(
  'supabase/migrations/20260920001100_requirement_resolutions.sql',
  'utf8',
);
const start = original.indexOf('create function public.resolve_pursuit_requirement(');
const end = original.indexOf('-- Resolution changes', start);
if (start < 0 || end < 0) throw new Error('Resolution function not found');
const sql = original
  .slice(start, end)
  .replace('create function', 'create or replace function')
  .replace(
    "'awaiting_clarification','waived')",
    "'awaiting_clarification','waived','not_applicable')",
  )
  .replace(
    "outcome in ('supported','waived')",
    "outcome in ('supported','waived','not_applicable')",
  );
writeFileSync(
  'supabase/migrations/20260921002400_requirement_not_applicable.sql',
  `-- Preserve immutable human findings; not-applicable is distinct from a buyer waiver.\nalter table public.requirement_resolution_history drop constraint requirement_resolution_history_disposition_check;\nalter table public.requirement_resolution_history add constraint requirement_resolution_history_disposition_check check(disposition in ('needs_review','supported','blocked','awaiting_clarification','waived','not_applicable'));\n${sql}`,
);
