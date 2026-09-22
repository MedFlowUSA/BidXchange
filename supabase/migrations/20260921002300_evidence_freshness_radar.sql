-- Current support expires with the source check, not just the document expiration.
create or replace view public.current_evidence_use_reviews with (security_invoker=true) as
select latest.*,
 (latest.proposal_use='approved' and latest.applicability='applicable'
 and latest.fact_version=f.updated_at and latest.requirement_version=r.updated_at
 and f.verification_status in ('verified','expiring') and f.verified_by is not null and f.verified_at is not null
 and nullif(btrim(f.value),'') is not null and nullif(btrim(f.source_reference),'') is not null
 and nullif(btrim(r.citation),'') is not null and f.sensitivity<>'unknown'
 and (f.expiration_date is null or f.expiration_date >= (now() at time zone 'UTC')::date)
 and (f.effective_date is null or f.effective_date <= (now() at time zone 'UTC')::date)
 and coalesce(nullif(f.structured_fields->>'last_checked','')::date,(f.verified_at at time zone 'UTC')::date) between (now() at time zone 'UTC')::date - 90 and (now() at time zone 'UTC')::date
 and m.status='active' and m.role in ('organization_admin','executive_approver')) as approval_current
from (select distinct on (organization_id,requirement_id,fact_id) * from public.evidence_use_reviews
 order by organization_id,requirement_id,fact_id,reviewed_at desc,sequence desc) latest
join public.profile_facts f on f.organization_id=latest.organization_id and f.id=latest.fact_id
join public.pursuit_requirements r on r.organization_id=latest.organization_id and r.id=latest.requirement_id
left join public.organization_memberships m on m.organization_id=latest.organization_id and m.user_id=latest.reviewed_by;
revoke all on public.current_evidence_use_reviews from public,anon;
grant select on public.current_evidence_use_reviews to authenticated;

alter table public.pursuit_requirements add column evidence_freshness_token text;
revoke update on public.pursuit_requirements from authenticated;
grant update(pursuit_id,requirement,citation,status,owner_user_id) on public.pursuit_requirements to authenticated;
create function public.refresh_pursuit_evidence_freshness(org uuid,pursuit uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare row record; signature text; affected integer:=0;
begin
 if auth.uid() is null or private.member_role(org) is null then raise exception 'Workspace access required' using errcode='42501'; end if;
 perform 1 from public.pursuits p where p.organization_id=org and p.id=pursuit and p.status not in ('closed','archived') for update;
 if not found then return 0; end if;
 for row in select r.id,r.evidence_freshness_token,r.owner_user_id from public.pursuit_requirements r where r.organization_id=org and r.pursuit_id=pursuit order by r.id loop
   select md5(jsonb_agg(jsonb_build_array(f.id,f.updated_at,f.expiration_date) order by f.id)::text) into signature
   from public.profile_facts f where f.organization_id=org
   and exists(select 1 from public.evidence_use_reviews v where v.organization_id=org and v.requirement_id=row.id and v.fact_id=f.id)
   and (f.expiration_date < (now() at time zone 'UTC')::date or
     coalesce(nullif(f.structured_fields->>'last_checked','')::date,(f.verified_at at time zone 'UTC')::date) < (now() at time zone 'UTC')::date-90);
   if signature is not null and signature is distinct from row.evidence_freshness_token then
     update public.pursuit_requirements set status='needs_review',evidence_freshness_token=signature,updated_at=clock_timestamp() where organization_id=org and id=row.id;
     insert into public.pursuit_tasks(organization_id,pursuit_id,requirement_id,title,status,priority,assigned_user_id,notes)
     values(org,pursuit,row.id,'Review expired or stale evidence for a linked requirement','todo','high',row.owner_user_id,'Evidence linked to this requirement is expired or was last checked more than 90 days ago. Review the authorized evidence trail; previous decisions and sign-offs need reaffirmation.');
     affected:=affected+1;
   end if;
 end loop;
 return affected;
end $$;
revoke all on function public.refresh_pursuit_evidence_freshness(uuid,uuid) from public,anon,authenticated;
grant execute on function public.refresh_pursuit_evidence_freshness(uuid,uuid) to authenticated;
