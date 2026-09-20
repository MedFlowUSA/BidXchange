-- Shared human requirement dispositions. Private evidence details remain protected.
create table public.requirement_resolution_history (
 id uuid primary key default gen_random_uuid(),
 sequence bigint generated always as identity unique,
 organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null,
 requirement_id uuid not null,
 requirement_version timestamptz not null,
 disposition text not null check(disposition in ('needs_review','supported','blocked','awaiting_clarification','waived')),
 reason text not null check(length(btrim(reason)) between 1 and 2000),
 authority_name text not null default '' check(length(authority_name)<=500),
 authority_reference text not null default '' check(length(authority_reference)<=2000),
 evidence_review_id uuid references public.evidence_use_reviews(id),
 reviewed_by uuid not null references auth.users(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id),
 foreign key(organization_id,requirement_id) references public.pursuit_requirements(organization_id,id)
);
alter table public.requirement_resolution_history enable row level security;
revoke all on public.requirement_resolution_history from public,anon,authenticated;
-- The evidence linkage is deliberately excluded from client-readable columns.
grant select(id,sequence,organization_id,pursuit_id,requirement_id,requirement_version,disposition,reason,authority_name,authority_reference,reviewed_by,reviewed_at) on public.requirement_resolution_history to authenticated;
revoke all on sequence public.requirement_resolution_history_sequence_seq from public,anon,authenticated;
create policy member_read on public.requirement_resolution_history for select to authenticated using(private.member_role(organization_id) is not null);
create index requirement_resolution_pair on public.requirement_resolution_history(organization_id,requirement_id,reviewed_at desc,sequence desc);
create trigger audit_resolution after insert on public.requirement_resolution_history for each row execute function private.audit_change();

create function private.requirement_resolution_current(resolution uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare h public.requirement_resolution_history; r public.pursuit_requirements; role_name text;
begin
 select * into h from public.requirement_resolution_history where id=resolution;
 if not found or auth.uid() is null or private.member_role(h.organization_id) is null then return false; end if;
 select * into r from public.pursuit_requirements where organization_id=h.organization_id and id=h.requirement_id;
 if not found or r.pursuit_id<>h.pursuit_id or r.updated_at is distinct from h.requirement_version then return false; end if;
 select role::text into role_name from public.organization_memberships where organization_id=h.organization_id and user_id=h.reviewed_by and status='active';
 if coalesce(role_name,'') not in ('organization_admin','executive_approver') then return false; end if;
 if h.disposition='waived' then return role_name='executive_approver' and length(btrim(h.authority_name))>0 and length(btrim(h.authority_reference))>0; end if;
 if h.disposition='supported' then
   return exists(select 1 from public.current_evidence_use_reviews v where v.id=h.evidence_review_id and v.organization_id=h.organization_id and v.requirement_id=h.requirement_id and v.approval_current is true);
 end if;
 return true;
end $$;
revoke all on function private.requirement_resolution_current(uuid) from public,anon,authenticated;
grant execute on function private.requirement_resolution_current(uuid) to authenticated;

create view public.current_requirement_resolutions with (security_invoker=true) as
select latest.*, private.requirement_resolution_current(latest.id) as review_current
from (select distinct on (organization_id,requirement_id)
 id,sequence,organization_id,pursuit_id,requirement_id,requirement_version,disposition,reason,authority_name,authority_reference,reviewed_by,reviewed_at
 from public.requirement_resolution_history order by organization_id,requirement_id,reviewed_at desc,sequence desc) latest;
revoke all on public.current_requirement_resolutions from public,anon,authenticated;
grant select on public.current_requirement_resolutions to authenticated;

create function public.resolve_pursuit_requirement(org uuid,target_requirement uuid,expected_version timestamptz,expected_previous uuid,outcome text,rationale text,evidence_review uuid,issuing_authority text,waiver_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.pursuit_requirements; e public.evidence_use_reviews; latest uuid; result uuid; role_name text;
begin
 role_name:=private.member_role(org)::text;
 if auth.uid() is null or coalesce(role_name,'') not in ('organization_admin','executive_approver') then raise exception 'Authorized human reviewer required' using errcode='42501'; end if;
 if outcome is null or outcome not in ('needs_review','supported','blocked','awaiting_clarification','waived') or rationale is null or length(btrim(rationale)) not between 1 and 2000 then raise exception 'Disposition and reason required'; end if;
 if outcome='waived' and (role_name<>'executive_approver' or issuing_authority is null or length(btrim(issuing_authority)) not between 1 and 500 or waiver_reference is null or length(btrim(waiver_reference)) not between 1 and 2000) then raise exception 'Executive review and documented issuing authority required'; end if;
 -- Match evidence-review lock order, so evidence corrections cannot race the support check.
 if outcome='supported' then
   select * into e from public.evidence_use_reviews where id=evidence_review and organization_id=org and requirement_id=target_requirement;
   if not found then raise exception 'Current approved evidence for this requirement required'; end if;
   perform 1 from public.profile_facts where organization_id=org and id=e.fact_id for update;
 end if;
 select * into r from public.pursuit_requirements where organization_id=org and id=target_requirement for update;
 if not found then raise exception 'Requirement unavailable' using errcode='42501'; end if;
 if r.updated_at is distinct from expected_version then raise exception 'Requirement changed; reload before reviewing'; end if;
 select id into latest from public.requirement_resolution_history where organization_id=org and requirement_id=target_requirement order by reviewed_at desc,sequence desc limit 1;
 if latest is distinct from expected_previous then raise exception 'Review changed; reload before reviewing'; end if;
 if outcome in ('supported','waived') and nullif(btrim(r.citation),'') is null then raise exception 'Cited requirement required'; end if;
 if outcome='supported' and not exists(select 1 from public.current_evidence_use_reviews v where v.id=evidence_review and v.organization_id=org and v.requirement_id=target_requirement and v.approval_current is true) then raise exception 'Current approved evidence for this requirement required'; end if;
 if not public.consume_admin_mutation() then raise exception 'Review rate limit reached'; end if;
 insert into public.requirement_resolution_history(organization_id,pursuit_id,requirement_id,requirement_version,disposition,reason,authority_name,authority_reference,evidence_review_id,reviewed_by)
 values(org,r.pursuit_id,target_requirement,r.updated_at,outcome,btrim(rationale),case when outcome='waived' then btrim(issuing_authority) else '' end,case when outcome='waived' then btrim(waiver_reference) else '' end,case when outcome='supported' then evidence_review else null end,auth.uid()) returning id into result;
 return result;
end $$;
revoke all on function public.resolve_pursuit_requirement(uuid,uuid,timestamptz,uuid,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.resolve_pursuit_requirement(uuid,uuid,timestamptz,uuid,text,text,uuid,text,text) to authenticated;

-- Resolution changes also require a fresh bid/no-bid review.
create or replace function public.pursuit_decision_context(org uuid,pursuit uuid) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if auth.uid() is null or private.member_role(org) is null then raise exception 'Workspace access required' using errcode='42501'; end if;
 select md5(jsonb_build_array(
   p.title,p.status,p.opportunity_id,o.updated_at,
   (select jsonb_agg(jsonb_build_array(r.id,r.updated_at) order by r.id) from public.pursuit_requirements r where r.organization_id=org and r.pursuit_id=p.id),
   (select jsonb_agg(jsonb_build_array(f.id,f.updated_at) order by f.id) from public.profile_facts f where f.organization_id=org),
   (select jsonb_agg(jsonb_build_array(v.id,v.approval_current) order by v.id) from public.current_evidence_use_reviews v join public.pursuit_requirements r on r.organization_id=v.organization_id and r.id=v.requirement_id where r.organization_id=org and r.pursuit_id=p.id),
   (select jsonb_agg(jsonb_build_array(x.id,x.review_current) order by x.id) from public.current_requirement_resolutions x where x.organization_id=org and x.pursuit_id=p.id),
   (now() at time zone 'UTC')::date
 )::text) into result from public.pursuits p join public.opportunities o on o.organization_id=p.organization_id and o.id=p.opportunity_id where p.organization_id=org and p.id=pursuit;
 if result is null then raise exception 'Pursuit unavailable' using errcode='42501'; end if;
 return result;
end $$;
revoke all on function public.pursuit_decision_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.pursuit_decision_context(uuid,uuid) to authenticated;

