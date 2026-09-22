import { readFileSync, writeFileSync } from 'node:fs';
import { companyTemplates } from '../apps/web/lib/company-fields';
const previous = readFileSync(
  'supabase/migrations/20260921001800_company_source_capabilities.sql',
  'utf8',
);
const catalog = JSON.stringify(companyTemplates).replaceAll("'", "''");
const start = previous.indexOf('create or replace function private.guard_structured_fact');
if (start < 0) throw new Error('Existing structured guard missing');
const sql = previous
  .slice(start)
  .replace(
    /declare catalog jsonb := '[\s\S]*?'::jsonb;/,
    `declare catalog jsonb := '${catalog}'::jsonb;`,
  );
writeFileSync(
  'supabase/migrations/20260921002000_california_passport_catalog.sql',
  '-- Additive optional California fields; existing facts, roles and audit history are unchanged.\n' +
    sql,
);
