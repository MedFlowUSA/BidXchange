-- Additive source metadata. Existing opportunities and portal permissions are unchanged.
alter table public.opportunities add column source_details jsonb;
alter table public.opportunities add constraint source_details_shape check (
 source_details is null or coalesce(
  jsonb_typeof(source_details)='object' and octet_length(source_details::text)<=60000
  and source_details->>'schema'='1'
  and length(source_details->>'sourceId') between 1 and 100
  and source_details->>'connectionMode'='manual'
  and source_details->'lastSynchronizedAt'='null'::jsonb
  and source_details->'dataConfidence'='null'::jsonb, false)
);
create index opportunities_source_registry_idx on public.opportunities(organization_id,(source_details->>'sourceId'));

create table public.source_registrations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 source_id text not null check(source_id ~ '^[a-z0-9.-]{1,100}$'),
 registration_status text not null default 'unknown' check(registration_status in ('unknown','not_registered','in_progress','registered','expired')),
 vendor_number text not null default '' check(length(vendor_number)<=200),
 evidence_reference text not null default '' check(length(evidence_reference)<=2000),
 portal_url text not null default '' check(length(portal_url)<=2000),
 expires_on date,
 schedule_number text not null default '' check(length(schedule_number)<=200),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,source_id),
 check(registration_status<>'registered' or length(btrim(evidence_reference))>0)
);
alter table public.source_registrations enable row level security;
revoke all on public.source_registrations from public,anon,authenticated;
grant select,insert,update on public.source_registrations to authenticated;
create policy member_read on public.source_registrations for select to authenticated using (private.member_role(organization_id) is not null);
create policy admin_insert on public.source_registrations for insert to authenticated with check(private.member_role(organization_id)='organization_admin');
create policy admin_update on public.source_registrations for update to authenticated using(private.member_role(organization_id)='organization_admin') with check(private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.source_registrations for each row execute function private.guard_tenant();
create trigger audit_record after insert or update on public.source_registrations for each row execute function private.audit_change();

create function private.guard_schedule_intake() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.source_details->>'sourceId'='gsa-ebuy' or new.source_url ~* '^https://(www[.])?ebuy[.]gsa[.]gov([/:?#]|$)') and (TG_OP='INSERT' or old.source_details->>'sourceId' is distinct from new.source_details->>'sourceId' or old.source_url is distinct from new.source_url) then
  if not exists(select 1 from public.source_registrations r where r.organization_id=new.organization_id and r.source_id='gsa-ebuy' and r.registration_status='registered' and r.schedule_number<>'' and r.evidence_reference<>'' and r.expires_on>=current_date) then
   raise exception 'Current recorded Schedule evidence is required for eBuy intake' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_schedule_intake() from public,anon,authenticated;
create trigger source_schedule_guard before insert or update on public.opportunities for each row execute function private.guard_schedule_intake();

create function public.source_registry_counts(org uuid) returns table(source_id text,active_count bigint) language sql stable security invoker set search_path='' as $$
 select o.source_details->>'sourceId', count(*) from public.opportunities o
 where o.organization_id=org and o.source_details is not null and o.status not in ('closed','cancelled','archived')
 group by o.source_details->>'sourceId'
$$;
revoke all on function public.source_registry_counts(uuid) from public,anon;
grant execute on function public.source_registry_counts(uuid) to authenticated;
