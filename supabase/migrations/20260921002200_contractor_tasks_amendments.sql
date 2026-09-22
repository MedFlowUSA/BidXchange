alter table public.pursuit_tasks add column requirement_id uuid,
 add column priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 add column notes text not null default '' check(length(notes)<=4000),
 add column completed_at timestamptz, add column created_by uuid references auth.users(id);
alter table public.pursuit_tasks add foreign key(organization_id,requirement_id) references public.pursuit_requirements(organization_id,id);
create index contractor_task_requirement on public.pursuit_tasks(organization_id,requirement_id) where requirement_id is not null;
create function private.guard_contractor_task() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.requirement_id is not null and not exists(select 1 from public.pursuit_requirements r where r.organization_id=new.organization_id and r.pursuit_id=new.pursuit_id and r.id=new.requirement_id) then raise exception 'Requirement must belong to this pursuit'; end if;
 if TG_OP='INSERT' then new.created_by:=auth.uid(); else new.created_by:=old.created_by; end if;
 if new.status='complete' then
  if TG_OP='INSERT' then new.completed_at:=clock_timestamp(); elsif old.status<>'complete' then new.completed_at:=clock_timestamp(); else new.completed_at:=old.completed_at; end if;
 else new.completed_at:=null; end if;
 return new;
end $$;
revoke all on function private.guard_contractor_task() from public,anon,authenticated;
create trigger contractor_task before insert or update on public.pursuit_tasks for each row execute function private.guard_contractor_task();

create table public.opportunity_amendments(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 opportunity_id uuid not null, label text not null check(length(btrim(label)) between 1 and 200),
 issued_on date, source_url text not null check(source_url ~ '^https://[^[:space:]]+$' and source_url !~ '^https://[^/]*@' and length(source_url)<=2000),
 summary text not null check(length(btrim(summary)) between 1 and 4000),
 notice_text text not null default '' check(length(notice_text)<=24000),
 reviewed boolean not null default false, reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 created_by uuid references auth.users(id), created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,opportunity_id) references public.opportunities(organization_id,id)
);
alter table public.opportunity_amendments enable row level security;
revoke all on public.opportunity_amendments from public,anon,authenticated;
grant select,insert,update on public.opportunity_amendments to authenticated;
create policy member_read on public.opportunity_amendments for select to authenticated using(private.member_role(organization_id) is not null);
create policy capture_insert on public.opportunity_amendments for insert to authenticated with check(private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy capture_update on public.opportunity_amendments for update to authenticated using(private.member_role(organization_id) in ('organization_admin','capture_manager')) with check(private.member_role(organization_id) in ('organization_admin','capture_manager'));
create index amendment_opportunity on public.opportunity_amendments(organization_id,opportunity_id,created_at desc);
create trigger immutable_tenant before update on public.opportunity_amendments for each row execute function private.guard_tenant();
create trigger audit_amendment after insert or update on public.opportunity_amendments for each row execute function private.audit_change();
create function private.amendment_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.opportunity_id<>old.opportunity_id then raise exception 'Amendment cannot move to another opportunity'; end if;
  new.created_by:=old.created_by; new.created_at:=old.created_at;
  if row(new.label,new.issued_on,new.source_url,new.summary,new.notice_text) is distinct from row(old.label,old.issued_on,old.source_url,old.summary,old.notice_text) then new.reviewed:=false; end if;
 else new.created_by:=auth.uid(); new.created_at:=clock_timestamp(); end if;
 new.updated_at:=clock_timestamp();
 if new.reviewed then new.reviewed_by:=auth.uid(); new.reviewed_at:=clock_timestamp(); else new.reviewed_by:=null;new.reviewed_at:=null;end if;
 update public.opportunities set updated_at=clock_timestamp() where organization_id=new.organization_id and id=new.opportunity_id;
 update public.pursuit_requirements r set status='needs_review',updated_at=clock_timestamp() where r.organization_id=new.organization_id and exists(select 1 from public.pursuits p where p.organization_id=r.organization_id and p.id=r.pursuit_id and p.opportunity_id=new.opportunity_id);
 return new;
end $$;
revoke all on function private.amendment_changed() from public,anon,authenticated;
create trigger amendment_context before insert or update on public.opportunity_amendments for each row execute function private.amendment_changed();

create function private.guard_register_amendments() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.opportunity_amendments a join public.pursuits p on p.organization_id=a.organization_id and p.opportunity_id=a.opportunity_id where p.organization_id=new.organization_id and p.id=new.pursuit_id and not a.reviewed) then
   raise exception 'Review recorded amendments before signing off the register';
 end if;
 return new;
end $$;
revoke all on function private.guard_register_amendments() from public,anon,authenticated;
create trigger register_amendments before insert on public.requirements_register_signoffs for each row execute function private.guard_register_amendments();
