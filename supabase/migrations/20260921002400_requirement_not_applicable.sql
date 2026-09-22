-- Preserve immutable human findings; not-applicable is distinct from a buyer waiver.
alter table public.requirement_resolution_history drop constraint requirement_resolution_history_disposition_check;
alter table public.requirement_resolution_history add constraint requirement_resolution_history_disposition_check check(disposition in ('needs_review','supported','blocked','awaiting_clarification','waived','not_applicable'));
create or replace function public.resolve_pursuit_requirement(org uuid,target_requirement uuid,expected_version timestamptz,expected_previous uuid,outcome text,rationale text,evidence_review uuid,issuing_authority text,waiver_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.pursuit_requirements; e public.evidence_use_reviews; latest uuid; result uuid; role_name text;
begin
 role_name:=private.member_role(org)::text;
 if auth.uid() is null or coalesce(role_name,'') not in ('organization_admin','executive_approver') then raise exception 'Authorized human reviewer required' using errcode='42501'; end if;
 if outcome is null or outcome not in ('needs_review','supported','blocked','awaiting_clarification','waived','not_applicable') or rationale is null or length(btrim(rationale)) not between 1 and 2000 then raise exception 'Disposition and reason required'; end if;
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
 if outcome in ('supported','waived','not_applicable') and nullif(btrim(r.citation),'') is null then raise exception 'Cited requirement required'; end if;
 if outcome='supported' and not exists(select 1 from public.current_evidence_use_reviews v where v.id=evidence_review and v.organization_id=org and v.requirement_id=target_requirement and v.approval_current is true) then raise exception 'Current approved evidence for this requirement required'; end if;
 if not public.consume_admin_mutation() then raise exception 'Review rate limit reached'; end if;
 insert into public.requirement_resolution_history(organization_id,pursuit_id,requirement_id,requirement_version,disposition,reason,authority_name,authority_reference,evidence_review_id,reviewed_by)
 values(org,r.pursuit_id,target_requirement,r.updated_at,outcome,btrim(rationale),case when outcome='waived' then btrim(issuing_authority) else '' end,case when outcome='waived' then btrim(waiver_reference) else '' end,case when outcome='supported' then evidence_review else null end,auth.uid()) returning id into result;
 return result;
end $$;
revoke all on function public.resolve_pursuit_requirement(uuid,uuid,timestamptz,uuid,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.resolve_pursuit_requirement(uuid,uuid,timestamptz,uuid,text,text,uuid,text,text) to authenticated;

