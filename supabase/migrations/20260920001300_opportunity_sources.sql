-- Prepared only. Production application requires separate approval.
create table public.procurement_sources (
 id text primary key check(id='sam.gov'), name text not null, official_url text not null,
 enabled boolean not null default false, last_attempt timestamptz, last_success timestamptz,
 last_status text not null default 'never_synchronized'
);
insert into public.procurement_sources(id,name,official_url) values('sam.gov','SAM.gov Contract Opportunities','https://sam.gov');
create table public.source_sync_runs (
 id uuid primary key default gen_random_uuid(), source_id text not null references public.procurement_sources,
 started_at timestamptz not null default now(), finished_at timestamptz, status text not null default 'running',
 date_from date not null, date_to date not null, pages integer not null default 0,
 received integer not null default 0, created integer not null default 0, updated integer not null default 0,
 unchanged integer not null default 0, failed integer not null default 0, error_code text,
 check(date_to >= date_from and date_to-date_from <=31)
);
create table public.source_records (
 id uuid primary key default gen_random_uuid(), source_id text not null references public.procurement_sources,
 external_id text not null check(length(external_id) between 1 and 100),
 first_seen timestamptz not null default now(), last_seen timestamptz not null default now(), last_checked timestamptz not null default now(),
 current_version_id uuid, unique(source_id,external_id)
);
create table public.source_record_versions (
 id uuid primary key default gen_random_uuid(), record_id uuid not null references public.source_records,
 prior_version_id uuid, captured_at timestamptz not null default now(),
 raw_snapshot jsonb not null check(octet_length(raw_snapshot::text)<=131072),
 normalized jsonb not null check(octet_length(normalized::text)<=131072),
 raw_checksum text not null check(raw_checksum ~ '^[a-f0-9]{64}$'), normalized_checksum text not null check(normalized_checksum ~ '^[a-f0-9]{64}$'),
 changed_fields text[] not null default '{}', severity text not null check(severity in ('critical','material','informational','none')),
 unique(record_id,id), foreign key(record_id,prior_version_id) references public.source_record_versions(record_id,id)
);
alter table public.source_records add foreign key(id,current_version_id) references public.source_record_versions(record_id,id);
create table public.source_sync_items (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.source_sync_runs,
 page integer not null, item_index integer not null, record_id uuid references public.source_records,
 outcome text not null, error_code text, unique(run_id,page,item_index)
);
create table public.source_operator_events (
 id uuid primary key default gen_random_uuid(), source_id text not null references public.procurement_sources,
 created_at timestamptz not null default now(), database_actor text not null default session_user,
 action text not null check(action in ('enable','disable'))
);
create table public.opportunity_searches (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 name text not null check(length(name) between 1 and 120), active boolean not null default false,
 filters jsonb not null check(jsonb_typeof(filters)='object' and octet_length(filters::text)<16000),
 created_by uuid not null references auth.users, reviewed_by uuid references auth.users,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), last_run timestamptz,
 unique(organization_id,id), check(not active or reviewed_by is not null)
);
create table public.source_inbox (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 record_id uuid not null references public.source_records, matched_version_id uuid not null,
 match_reasons jsonb not null default '[]', missing_information jsonb not null default '[]',
 search_id uuid, search_version timestamptz,
 status text not null default 'new' check(status in ('new','needs_review','saved','converted','dismissed')),
 assigned_user_id uuid, priority text not null default 'normal' check(priority in ('normal','critical')),
 disposition_reason text not null default '' check(length(disposition_reason)<=2000),
 reviewed_by uuid references auth.users, reviewed_at timestamptz, change_pending boolean not null default false,
 opportunity_id uuid, converted_version_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,record_id), unique(organization_id,id),
 foreign key(record_id,matched_version_id) references public.source_record_versions(record_id,id),
 foreign key(record_id,converted_version_id) references public.source_record_versions(record_id,id),
 foreign key(organization_id,opportunity_id) references public.opportunities(organization_id,id),
 foreign key(organization_id,search_id) references public.opportunity_searches(organization_id,id),
 foreign key(organization_id,assigned_user_id) references public.organization_memberships(organization_id,user_id)
);
create index source_inbox_tenant_status on public.source_inbox(organization_id,status,created_at desc);
create index source_versions_record on public.source_record_versions(record_id,captured_at desc);
create function private.source_version_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Source versions are immutable' using errcode='42501'; end $$;
create trigger immutable_source_version before update or delete on public.source_record_versions for each row execute function private.source_version_immutable();

-- Source metadata is readable only through a tenant's inbox association. Raw snapshots
-- and connector administration have no authenticated grants.
do $$ declare t text; begin
 foreach t in array array['procurement_sources','source_sync_runs','source_records','source_record_versions','source_sync_items','source_operator_events','opportunity_searches','source_inbox'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
 foreach t in array array['opportunity_searches','source_inbox'] loop
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy tenant_read on public.%I for select to authenticated using(private.member_role(organization_id) is not null)',t);
 execute format('create trigger immutable_tenant before update on public.%I for each row execute function private.guard_tenant()',t);
 execute format('create trigger audit_record after insert or update on public.%I for each row execute function private.audit_change()',t);
 end loop;
end $$;
grant select on public.source_records to authenticated;
grant select(id,record_id,prior_version_id,captured_at,normalized,changed_fields,severity) on public.source_record_versions to authenticated;
create policy linked_source_read on public.source_records for select to authenticated using(exists(select 1 from public.source_inbox i where i.record_id=source_records.id and private.member_role(i.organization_id) is not null));
create policy linked_version_read on public.source_record_versions for select to authenticated using(exists(select 1 from public.source_inbox i where i.record_id=source_record_versions.record_id and private.member_role(i.organization_id) is not null));

create function private.valid_source_filters(filters jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; term jsonb;
begin
 if jsonb_typeof(filters) is distinct from 'object' or octet_length(filters::text)>16000 then return false; end if;
 for k,v in select * from jsonb_each(filters) loop
  if k in ('minimumDays','maximumDays') then
   if v<>'null'::jsonb and (jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]{1,3}$' or (v::text)::integer>365) then return false; end if;
  elsif k in ('naics','keywords','excludedKeywords','states','agencies','noticeTypes','setAsides') then
   if jsonb_typeof(v)<>'array' or jsonb_array_length(v)>30 then return false; end if;
   for term in select * from jsonb_array_elements(v) loop
    if jsonb_typeof(term)<>'string' or length(btrim(term#>>'{}')) not between 1 and 100 then return false; end if;
   end loop;
  else return false;
  end if;
 end loop;
 if filters->>'minimumDays' is not null and filters->>'maximumDays' is not null and (filters->>'minimumDays')::integer>(filters->>'maximumDays')::integer then return false; end if;
 return true;
exception when others then return false;
end $$;
alter table public.opportunity_searches add constraint valid_filters check(private.valid_source_filters(filters));
create function public.save_opportunity_search(org uuid, search_id uuid, expected timestamptz, search_name text, search_filters jsonb, activate boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if coalesce(private.member_role(org)::text,'') not in ('organization_admin','capture_manager') then raise exception 'Access denied' using errcode='42501'; end if;
 if not public.consume_admin_mutation() then raise exception 'Rate limited'; end if;
 if search_id is null then
  perform pg_advisory_xact_lock(hashtextextended(org::text,13));
  if (select count(*) from public.opportunity_searches where organization_id=org)>=30 then raise exception 'Search limit'; end if;
  insert into public.opportunity_searches(organization_id,name,filters,active,created_by,reviewed_by) values(org,search_name,search_filters,activate,auth.uid(),case when activate then auth.uid() end) returning id into result;
 else
  update public.opportunity_searches set name=search_name,filters=search_filters,active=activate,reviewed_by=case when activate then auth.uid() end
  where id=search_id and organization_id=org and updated_at=expected returning id into result;
  if result is null then raise exception 'Stale search'; end if;
 end if;
 return result;
end $$;
create function public.review_source_item(org uuid,item uuid,expected timestamptz,expected_version uuid,disposition text,reason text,reviewer uuid,confirm_conversion boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare row public.source_inbox; source public.source_records; notice jsonb; result uuid;
begin
 if coalesce(private.member_role(org)::text,'') not in ('organization_admin','capture_manager') then raise exception 'Access denied' using errcode='42501'; end if;
 if not public.consume_admin_mutation() then raise exception 'Rate limited'; end if;
 select * into row from public.source_inbox where id=item and organization_id=org for update;
 if row.id is null then raise exception 'Unavailable'; end if;
 if row.opportunity_id is not null and disposition='converted' then return row.opportunity_id; end if;
 select * into source from public.source_records where id=row.record_id for share;
 if row.updated_at is distinct from expected or source.current_version_id is distinct from expected_version then raise exception 'Source changed; reload'; end if;
 if reviewer is not null and not exists(select 1 from public.organization_memberships where organization_id=org and user_id=reviewer and status='active') then raise exception 'Reviewer unavailable'; end if;
 if disposition not in ('needs_review','saved','converted','dismissed') or length(btrim(reason)) not between 1 and 2000 then raise exception 'Review reason required'; end if;
 result:=row.opportunity_id;
 if disposition='converted' then
  if confirm_conversion is distinct from true then raise exception 'Confirmation required'; end if;
  select normalized into notice from public.source_record_versions where id=source.current_version_id;
  insert into public.opportunities(organization_id,title,buyer,solicitation_number,source_url,source_note,official_deadline,deadline_timezone,status)
  values(org,notice->>'title',concat_ws(' / ',notice->>'department',notice->>'office'),notice->>'solicitationNumber',notice->>'sourceUrl',
   'Official SAM.gov source. Observed version '||source.current_version_id::text||'. Review source inbox for current metadata. Search match is not eligibility.',
   (notice->>'deadlineInstant')::timestamptz,'UTC','inbox') returning id into result;
 end if;
 update public.source_inbox set status=disposition,disposition_reason=reason,assigned_user_id=reviewer,reviewed_by=auth.uid(),reviewed_at=now(),change_pending=false,priority='normal',
 opportunity_id=result,converted_version_id=case when disposition='converted' then source.current_version_id else converted_version_id end
 where id=item and organization_id=org;
 return result;
end $$;
revoke all on function public.save_opportunity_search(uuid,uuid,timestamptz,text,jsonb,boolean) from public,anon;
revoke all on function public.review_source_item(uuid,uuid,timestamptz,uuid,text,text,uuid,boolean) from public,anon;
grant execute on function public.save_opportunity_search(uuid,uuid,timestamptz,text,jsonb,boolean) to authenticated;
grant execute on function public.review_source_item(uuid,uuid,timestamptz,uuid,text,text,uuid,boolean) to authenticated;
create function public.source_connection_status(org uuid) returns table(enabled boolean,last_attempt timestamptz,last_success timestamptz,last_status text)
language plpgsql security definer set search_path='' as $$
begin
 if private.member_role(org) is null then raise exception 'Access denied' using errcode='42501'; end if;
 return query select s.enabled,s.last_attempt,s.last_success,s.last_status from public.procurement_sources s where s.id='sam.gov';
end $$;
revoke all on function public.source_connection_status(uuid) from public,anon;
grant execute on function public.source_connection_status(uuid) to authenticated;
