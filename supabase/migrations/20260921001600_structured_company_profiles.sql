-- Structured details share the fact's RLS, review version and audit history.
alter table public.profile_facts add column structured_kind text, add column structured_fields jsonb;
alter table public.profile_facts add constraint structured_pair check ((structured_kind is null) = (structured_fields is null));
create function private.guard_structured_fact() returns trigger language plpgsql set search_path='' as $body$
declare catalog jsonb := '{"mailing_address":{"type":"identity","label":"Business mailing address","autofill":"Company address","fields":[{"key":"line1","label":"Address line 1"},{"key":"line2","label":"Address line 2"},{"key":"city","label":"City"},{"key":"region","label":"State / province"},{"key":"postal_code","label":"Postal code"},{"key":"country","label":"Country"}]},"business_phone":{"type":"identity","label":"Business phone","autofill":"Business phone","fields":[{"key":"number","label":"Phone number"},{"key":"extension","label":"Extension"}]},"business_email":{"type":"identity","label":"Business email","autofill":"Business email","fields":[{"key":"email","label":"Business email address","format":"email"}]},"representative":{"type":"identity","label":"Authorized company representative","autofill":"Company contact","fields":[{"key":"name","label":"Representative name"},{"key":"title","label":"Job title"},{"key":"email","label":"Work email","format":"email"},{"key":"phone","label":"Work phone"},{"key":"authority","label":"Authority reference"}]},"entity":{"type":"identity","label":"Legal business name","fields":[{"key":"legal_name","label":"Legal business name"},{"key":"operating_name","label":"Operating name / DBA"},{"key":"entity_type","label":"Entity type"},{"key":"formation_jurisdiction","label":"Formation jurisdiction"},{"key":"established","label":"Date established","format":"date"}]},"registration":{"type":"registration","label":"Registration","fields":[{"key":"program","label":"Registry / program"},{"key":"identifier","label":"Public registration identifier"},{"key":"entity","label":"Registered entity"},{"key":"jurisdiction","label":"Jurisdiction / buyer"},{"key":"status","label":"Recorded status"}]},"uei_cage":{"type":"registration","label":"UEI and CAGE identifiers","fields":[{"key":"uei","label":"UEI"},{"key":"cage","label":"CAGE code"},{"key":"entity","label":"Registered entity"}]},"license":{"type":"license","label":"License","fields":[{"key":"number","label":"License number"},{"key":"issuer","label":"Issuing authority"},{"key":"classification","label":"Classification"},{"key":"jurisdiction","label":"Jurisdiction"},{"key":"holder","label":"License holder"},{"key":"status","label":"Recorded status"}]},"certification":{"type":"certification","label":"Certification","fields":[{"key":"name","label":"Certification name"},{"key":"number","label":"Certificate identifier"},{"key":"issuer","label":"Certifying body"},{"key":"scope","label":"Applicable scope"},{"key":"status","label":"Recorded status"}]},"insurance":{"type":"insurance","label":"Insurance policy","fields":[{"key":"carrier","label":"Carrier"},{"key":"type","label":"Policy type"},{"key":"number","label":"Policy number"},{"key":"occurrence_limit","label":"Per-occurrence limit","format":"amount"},{"key":"aggregate_limit","label":"Aggregate limit","format":"amount"},{"key":"currency","label":"Currency","format":"code"},{"key":"endorsements","label":"Endorsements"},{"key":"exclusions","label":"Exclusions"}]},"bonding":{"type":"bonding","label":"Bonding capacity","fields":[{"key":"surety","label":"Surety"},{"key":"single_limit","label":"Single-project limit","format":"amount"},{"key":"aggregate_limit","label":"Aggregate limit","format":"amount"},{"key":"committed","label":"Committed capacity","format":"amount"},{"key":"remaining","label":"Confirmed remaining capacity","format":"amount"},{"key":"currency","label":"Currency","format":"code"},{"key":"assessed","label":"Assessment date","format":"date"},{"key":"conditions","label":"Conditions"}]},"project":{"type":"past_performance","label":"Comparable project reference","fields":[{"key":"name","label":"Project name"},{"key":"client","label":"Client"},{"key":"scope","label":"Comparable scope"},{"key":"role","label":"Prime / subcontractor role"},{"key":"start","label":"Start date","format":"date"},{"key":"end","label":"Completion date","format":"date"},{"key":"value","label":"Contract value","format":"amount"},{"key":"currency","label":"Currency","format":"code"},{"key":"outcome","label":"Documented outcome"},{"key":"reference","label":"Reference contact and permission"}]},"personnel":{"type":"personnel","label":"Key personnel qualifications","fields":[{"key":"name","label":"Person name"},{"key":"role","label":"Proposed role"},{"key":"qualifications","label":"Qualifications"},{"key":"credentials","label":"Professional credentials"},{"key":"available","label":"Available from","format":"date"},{"key":"resume","label":"Resume reference"},{"key":"permission","label":"Proposal-use permission reference"}]},"equipment":{"type":"capacity","label":"Equipment availability","fields":[{"key":"name","label":"Equipment / asset"},{"key":"quantity","label":"Quantity","format":"amount"},{"key":"ownership","label":"Owned / leased / partner"},{"key":"location","label":"Operating location"},{"key":"available","label":"Available from","format":"date"},{"key":"limitations","label":"Availability conditions"}]}}'::jsonb; template jsonb; fld jsonb; val text; summary text := ''; entry record; changed boolean := false; has_money boolean := false;
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
   summary := summary || case when summary='' then '' else E'\n' end || (fld->>'label') || ': ' || val;
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
