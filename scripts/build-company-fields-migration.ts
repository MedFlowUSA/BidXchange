// Run only while migration 016 is unpublished. Catalog changes after release need a new migration.
import { writeFileSync } from 'node:fs';
import { companyTemplates } from '../apps/web/lib/company-fields';
const catalog = JSON.stringify(companyTemplates).replaceAll("'", "''");
const sql = `-- Structured details share the fact's RLS, review version and audit history.
alter table public.profile_facts add column structured_kind text, add column structured_fields jsonb;
alter table public.profile_facts add constraint structured_pair check ((structured_kind is null) = (structured_fields is null));
create function private.guard_structured_fact() returns trigger language plpgsql set search_path='' as $body$
declare catalog jsonb := '${catalog}'::jsonb; template jsonb; fld jsonb; val text; summary text := ''; entry record; changed boolean := false; has_money boolean := false;
begin
 if TG_OP='UPDATE' then
  changed := new.structured_kind is distinct from old.structured_kind or new.structured_fields is distinct from old.structured_fields
    or new.fact_type is distinct from old.fact_type or new.label is distinct from old.label
    or new.effective_date is distinct from old.effective_date or new.sensitivity is distinct from old.sensitivity
    or new.source_note is distinct from old.source_note;
  if old.structured_kind is not null and new.structured_kind is distinct from old.structured_kind then
   raise exception 'Structured record format cannot be changed; create a separate evidence record';
  end if;
 end if;
 if new.structured_kind is not null then
  template := catalog -> new.structured_kind;
  if template is null or template->>'type' <> new.fact_type or jsonb_typeof(new.structured_fields) is distinct from 'object' or octet_length(new.structured_fields::text)>16000 then
   raise exception 'Invalid structured company record';
  end if;
  for entry in select key,value from jsonb_each(new.structured_fields) loop
   if not exists(select 1 from jsonb_array_elements(template->'fields') f where f->>'key'=entry.key) or jsonb_typeof(entry.value)<>'string' then raise exception 'Unsupported structured field'; end if;
  end loop;
  for fld in select value from jsonb_array_elements(template->'fields') loop
   val := coalesce(new.structured_fields->>(fld->>'key'),'');
   if length(val)>500 or val<>btrim(val) then raise exception 'Invalid structured text'; end if;
   if val='' then continue; end if;
   if fld->>'format'='amount' then
    if val !~ '^(0|[1-9][0-9]{0,12})([.][0-9]{1,2})?$' then raise exception 'Invalid structured amount'; end if;
    if fld->>'key'<>'quantity' then has_money := true; end if;
   end if;
   if fld->>'format'='code' and val !~ '^[A-Z]{3}$' then raise exception 'Invalid currency'; end if;
   if fld->>'format'='email' and val !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Invalid email'; end if;
   if fld->>'format'='date' then
    if val !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(val::date,'YYYY-MM-DD')<>val then raise exception 'Invalid date'; end if;
   end if;
   summary := summary || case when summary='' then '' else E'\\n' end || (fld->>'label') || ': ' || val;
  end loop;
  if has_money and coalesce(new.structured_fields->>'currency','')='' then raise exception 'Currency required'; end if;
  if new.structured_kind='project' and coalesce(new.structured_fields->>'start','')<>'' and coalesce(new.structured_fields->>'end','')<>'' and new.structured_fields->>'end' < new.structured_fields->>'start' then raise exception 'Completion precedes start'; end if;
  new.value := nullif(summary,'');
 end if;
 if changed then new.verification_status := 'pending_verification'; new.verified_by := null; new.verified_at := null; end if;
 return new;
end $body$;
revoke all on function private.guard_structured_fact() from public,anon,authenticated;
-- Runs before existing verify_fact; canonical text and structural edits invalidate review.
create trigger aa_structured_fact before insert or update on public.profile_facts for each row execute function private.guard_structured_fact();
`;
writeFileSync('supabase/migrations/20260921001600_structured_company_profiles.sql', sql);
