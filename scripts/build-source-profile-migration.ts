import { readFileSync, writeFileSync } from 'node:fs';
import { companyTemplates } from '../apps/web/lib/company-fields';
const original = readFileSync('supabase/migrations/20260921001600_structured_company_profiles.sql','utf8');
const start = original.indexOf('create function private.guard_structured_fact()');
const end = original.indexOf('revoke all on function private.guard_structured_fact()');
if(start<0 || end<0) throw new Error('Migration template missing');
const sql = original.slice(start,end).replace('create function','create or replace function').replace(/declare catalog jsonb := '[^\n]+'::jsonb; template/, `declare catalog jsonb := '${JSON.stringify(companyTemplates).replaceAll("'","''")}'::jsonb; template`);
writeFileSync('supabase/migrations/20260921001800_company_source_capabilities.sql', '-- Extend structured templates without changing existing facts, visibility or verification.\n'+sql);
