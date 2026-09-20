-- Historical human decisions, not pricing/certification/submission authority.
create table public.pursuit_decision_history (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null,
 decision text not null check(decision in ('bid','no_bid','pending')),
 reason text not null check(length(btrim(reason)) between 1 and 4000),
 conditions text not null check(length(conditions)<=4000),
 context_token text not null,
 decided_by uuid not null references auth.users(id),
 decided_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id)
);
alter table public.pursuit_decision_history enable row level security;
revoke all on public.pursuit_decision_history from public,anon,authenticated;
grant select on public.pursuit_decision_history to authenticated;
create policy member_read on public.pursuit_decision_history for select to authenticated using(private.member_role(organization_id) is not null);
create index pursuit_decision_history_pair on public.pursuit_decision_history(organization_id,pursuit_id,decided_at desc);
create trigger audit_decision after insert on public.pursuit_decision_history for each row execute function private.audit_change();
-- Decisions are writable only through the attributed RPC, including for administrators.
revoke update on public.pursuits from authenticated;
grant update(title,status,opportunity_id) on public.pursuits to authenticated;

create function public.pursuit_decision_context(org uuid,pursuit uuid) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if auth.uid() is null or private.member_role(org) is null then raise exception 'Workspace access required' using errcode='42501'; end if;
 select md5(jsonb_build_array(
   p.title,p.status,p.opportunity_id,o.updated_at,
   (select jsonb_agg(jsonb_build_array(r.id,r.updated_at) order by r.id) from public.pursuit_requirements r where r.organization_id=org and r.pursuit_id=p.id),
   (select jsonb_agg(jsonb_build_array(f.id,f.updated_at) order by f.id) from public.profile_facts f where f.organization_id=org),
   (select jsonb_agg(jsonb_build_array(v.id,v.approval_current) order by v.id) from public.current_evidence_use_reviews v join public.pursuit_requirements r on r.organization_id=v.organization_id and r.id=v.requirement_id where r.organization_id=org and r.pursuit_id=p.id),
   (now() at time zone 'UTC')::date
 )::text) into result from public.pursuits p join public.opportunities o on o.organization_id=p.organization_id and o.id=p.opportunity_id where p.organization_id=org and p.id=pursuit;
 if result is null then raise exception 'Pursuit unavailable' using errcode='42501'; end if;
 return result;
end $$;
revoke all on function public.pursuit_decision_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.pursuit_decision_context(uuid,uuid) to authenticated;

create or replace function private.guard_pursuit_decision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
   if new.decision<>'pending' or new.decided_by is not null or new.decided_at is not null or new.decision_reason is not null then raise exception 'Record decisions through the decision workflow'; end if;
 elsif row(new.decision,new.decision_reason,new.decided_by,new.decided_at) is distinct from row(old.decision,old.decision_reason,old.decided_by,old.decided_at) then
   if auth.uid() is null or coalesce(private.member_role(new.organization_id)::text,'') not in ('organization_admin','executive_approver') or not exists(
     select 1 from public.pursuit_decision_history h where h.organization_id=new.organization_id and h.pursuit_id=new.id and h.decision=new.decision and h.reason=new.decision_reason and h.decided_by=auth.uid() and h.decided_by=new.decided_by and h.decided_at=new.decided_at
   ) then raise exception 'Record decisions through the decision workflow' using errcode='42501'; end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_pursuit_decision() from public,anon,authenticated;

create function public.record_pursuit_decision(org uuid,pursuit uuid,expected_version timestamptz,expected_context text,outcome text,rationale text,limits text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.pursuits; entry public.pursuit_decision_history; context text;
begin
 if auth.uid() is null or coalesce(private.member_role(org)::text,'') not in ('organization_admin','executive_approver') then raise exception 'Authorized human decision maker required' using errcode='42501'; end if;
 if outcome is null or outcome not in ('bid','no_bid','pending') or rationale is null or length(btrim(rationale)) not between 1 and 4000 or limits is null or length(limits)>4000 then raise exception 'Decision and reason required'; end if;
 select * into p from public.pursuits where organization_id=org and id=pursuit for update;
 if not found then raise exception 'Pursuit unavailable' using errcode='42501'; end if;
 if p.updated_at is distinct from expected_version then raise exception 'Pursuit changed; reload before deciding'; end if;
 context:=public.pursuit_decision_context(org,pursuit);
 if context is distinct from expected_context then raise exception 'Review context changed; reload before deciding'; end if;
 if not public.consume_admin_mutation() then raise exception 'Decision rate limit reached'; end if;
 insert into public.pursuit_decision_history(organization_id,pursuit_id,decision,reason,conditions,context_token,decided_by)
 values(org,pursuit,outcome,btrim(rationale),btrim(limits),context,auth.uid()) returning * into entry;
 update public.pursuits set decision=outcome,decision_reason=entry.reason,decided_by=entry.decided_by,decided_at=entry.decided_at where organization_id=org and id=pursuit;
 return entry.id;
end $$;
revoke all on function public.record_pursuit_decision(uuid,uuid,timestamptz,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_pursuit_decision(uuid,uuid,timestamptz,text,text,text,text) to authenticated;
