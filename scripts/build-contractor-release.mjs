import { readFileSync, writeFileSync } from 'node:fs';
const original = readFileSync(
  'supabase/migrations/20260921001500_response_release_workflow.sql',
  'utf8',
);
const start = original.indexOf('create function public.response_release_status(');
const end = original.indexOf('end $$;', start) + 'end $$;'.length;
if (start < 0 || end < start) throw new Error('Release validator not found');
const sql = original
  .slice(start, end)
  .replace('create function', 'create or replace function')
  .replaceAll(
    '(complete|confirm|describe|check|insert|add)',
    '(human input required|complete|confirm|describe|check|not recorded|answer not supplied|response overview not supplied|insert|add)',
  )
  .replaceAll("('supported','waived')", "('supported','waived','not_applicable')")
  .replaceAll(
    'current supported/waived finding',
    'current supported, not-applicable or buyer-waiver finding',
  );
writeFileSync(
  'supabase/migrations/20260921002500_contractor_release_placeholders.sql',
  `-- Preserve release approval checks and recognize human-input placeholders and explicit not-applicable findings.\n${sql}\n`,
);
