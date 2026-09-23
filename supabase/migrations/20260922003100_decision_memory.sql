-- Company-wide historical memory. No automated decision or requirement mutation.
alter table public.pursuit_decision_history
 add column company_profile_id uuid,
 add column opportunity_snapshot jsonb,
 add column match_features text[],
 add column match_version text,
 add constraint decision_passport_fk foreign key(organization_id,company_profile_id) references public.company_profiles(organization_id,id),
 add constraint decision_memory_pair unique(organization_id,id);
-- Only the unambiguous Passport association is backfilled. No historical facts invented.
update public.pursuit_decision_history h set company_profile_id=p.id
 from public.company_profiles p where p.organization_id=h.organization_id;
create index decision_memory_company on public.pursuit_decision_history(organization_id,decided_at desc,id) where decision='no_bid';
create index decision_memory_features on public.pursuit_decision_history using gin(match_features) where decision='no_bid';

create function private.decision_match_features(buyer text,source_text text) returns text[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct token order by token),'{}'::text[]) from (
 select 'agency:'||trim(regexp_replace(lower(buyer),'[^[:alnum:]]+',' ','g')) token where nullif(trim(regexp_replace(lower(buyer),'[^[:alnum:]]+',' ','g')),'') is not null
 union all select 'trade:'||lower(m[1]) from regexp_matches(source_text,'\m(C-[0-9]{1,2})\M','gi') m
 union all select 'requirement:'||kind from (values
 ('bond','\m(bond|bonding|surety)\M'),('insurance','\m(insurance|insured)\M'),
 ('site_visit','\m(job walk|site visit|pre-bid meeting)\M'),('dir','\m(DIR|PWCR)\M'),
 ('certified_payroll','certified payroll'),('prevailing_wage','prevailing wage'),
 ('license','\m(CSLB|license|licensing)\M')) patterns(kind,pattern) where source_text ~* pattern
 ) tokens
$$;
revoke all on function private.decision_match_features(text,text) from public,anon,authenticated;

create function private.capture_decision_memory() returns trigger language plpgsql security definer set search_path='' as $$
declare o public.opportunities; source_text text;
begin
 if TG_OP='UPDATE' then
  if row(new.company_profile_id,new.opportunity_snapshot,new.match_features,new.match_version) is distinct from row(old.company_profile_id,old.opportunity_snapshot,old.match_features,old.match_version) then raise exception 'Decision memory is immutable'; end if;
  return new;
 end if;
 select id into new.company_profile_id from public.company_profiles where organization_id=new.organization_id;
 select x.* into o from public.opportunities x join public.pursuits p on p.organization_id=x.organization_id and p.opportunity_id=x.id where p.organization_id=new.organization_id and p.id=new.pursuit_id;
 new.opportunity_snapshot:=jsonb_build_object('id',o.id,'title',o.title,'buyer',o.buyer,'solicitation_number',o.solicitation_number,'source_url',o.source_url,'captured_at',new.decided_at);
 select concat_ws(' ',o.title,o.summary,string_agg(r.requirement,' ' order by r.id)) into source_text from public.pursuit_requirements r where r.organization_id=new.organization_id and r.pursuit_id=new.pursuit_id and r.archived_at is null;
 new.match_features:=private.decision_match_features(o.buyer,source_text);
 new.match_version:='contractor-memory-v1';
 return new;
end $$;
revoke all on function private.capture_decision_memory() from public,anon,authenticated;
create trigger capture_decision_memory before insert or update on public.pursuit_decision_history for each row execute function private.capture_decision_memory();

create table public.decision_memory_reviews (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
 organization_id uuid not null references public.organizations(id), decision_id uuid not null,
 opportunity_id uuid not null, reason_code text not null,
 assessment text not null check(assessment in ('resolved','still_unresolved','not_applicable')),
 note text not null check(length(btrim(note)) between 1 and 2000),
 source_reference text not null check(length(btrim(source_reference)) between 1 and 1000),
 context_token text not null, reviewed_by uuid not null references auth.users(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,decision_id) references public.pursuit_decision_history(organization_id,id),
 foreign key(organization_id,opportunity_id) references public.opportunities(organization_id,id)
);
alter table public.decision_memory_reviews enable row level security;
revoke all on public.decision_memory_reviews from public,anon,authenticated;
revoke all on sequence public.decision_memory_reviews_sequence_seq from public,anon,authenticated;
grant select on public.decision_memory_reviews to authenticated;
create policy member_read on public.decision_memory_reviews for select to authenticated using(private.member_role(organization_id) is not null);
create index decision_memory_review_latest on public.decision_memory_reviews(organization_id,opportunity_id,decision_id,reason_code,sequence desc);
create trigger audit_memory_review after insert on public.decision_memory_reviews for each row execute function private.audit_change();

-- A conservative context includes all company evidence versions, all target requirements,
-- active decision-maker roles and the UTC date (expiration/freshness cannot persist forever).
create function public.decision_memory_context(org uuid,target uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare result text;
begin
 if auth.uid() is null or private.member_role(org) is null then raise exception 'Workspace access required' using errcode='42501'; end if;
 select md5(jsonb_build_array(o.id,o.updated_at,
 (select jsonb_agg(jsonb_build_array(c.id,c.updated_at) order by c.id) from public.company_profiles c where c.organization_id=org),
 (select jsonb_agg(jsonb_build_array(f.id,f.updated_at) order by f.id) from public.profile_facts f where f.organization_id=org),
 (select jsonb_agg(jsonb_build_array(r.id,r.updated_at) order by r.id) from public.pursuit_requirements r join public.pursuits p on p.organization_id=r.organization_id and p.id=r.pursuit_id where p.organization_id=org and p.opportunity_id=target),
 (select jsonb_agg(h.id order by h.id) from public.requirement_resolution_history h join public.pursuits p on p.organization_id=h.organization_id and p.id=h.pursuit_id where p.organization_id=org and p.opportunity_id=target),
 (select jsonb_agg(jsonb_build_array(m.user_id,m.role,m.status) order by m.user_id) from public.organization_memberships m where m.organization_id=org),
 (now() at time zone 'UTC')::date)::text) into result from public.opportunities o where o.organization_id=org and o.id=target;
 if result is null then raise exception 'Opportunity unavailable' using errcode='42501'; end if;
 return result;
end $$;
revoke all on function public.decision_memory_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.decision_memory_context(uuid,uuid) to authenticated;

create function public.review_decision_memory(org uuid,decision uuid,target uuid,reason text,outcome text,explanation text,reference text,expected_context text,expected_previous uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare h public.pursuit_decision_history; previous uuid; result uuid; context text;
begin
 if auth.uid() is null or coalesce(private.member_role(org)::text,'') not in ('organization_admin','executive_approver') then raise exception 'Authorized human reviewer required' using errcode='42501'; end if;
 -- Serialize reviews per notice; compare-and-set prevents concurrent overwrites.
 perform 1 from public.opportunities where organization_id=org and id=target for update;
 if not found then raise exception 'Opportunity unavailable' using errcode='42501'; end if;
 select d.* into h from public.pursuit_decision_history d where d.organization_id=org and d.id=review_decision_memory.decision and d.decision='no_bid';
 if not found or not(reason=any(h.reason_codes)) then raise exception 'Historical reason unavailable'; end if;
 if h.opportunity_snapshot->>'id'=target::text then raise exception 'Review a different opportunity'; end if;
 if outcome is null or outcome not in ('resolved','still_unresolved','not_applicable') or explanation is null or length(btrim(explanation)) not between 1 and 2000 or reference is null or length(btrim(reference)) not between 1 and 1000 then raise exception 'Assessment, explanation and source required'; end if;
 context:=public.decision_memory_context(org,target);
 if context is distinct from expected_context then raise exception 'Records changed; refresh before reviewing'; end if;
 select id into previous from public.decision_memory_reviews where organization_id=org and opportunity_id=target and decision_id=decision and reason_code=reason order by sequence desc limit 1;
 if previous is distinct from expected_previous then raise exception 'Assessment changed; refresh before reviewing'; end if;
 if not public.consume_admin_mutation() then raise exception 'Review rate limit reached'; end if;
 insert into public.decision_memory_reviews(organization_id,decision_id,opportunity_id,reason_code,assessment,note,source_reference,context_token,reviewed_by)
 values(org,decision,target,reason,outcome,btrim(explanation),btrim(reference),context,auth.uid()) returning id into result;
 return result;
end $$;
revoke all on function public.review_decision_memory(uuid,uuid,uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.review_decision_memory(uuid,uuid,uuid,text,text,text,text,text,uuid) to authenticated;

create function public.similar_no_bid_decisions(org uuid,target uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare features text[]; result jsonb; context text;
begin
 context:=public.decision_memory_context(org,target);
 -- The helper remains private; only the security-definer scoped wrapper can compute features.
 features:=public.opportunity_decision_features(org,target);
 select coalesce(jsonb_agg(to_jsonb(matches)),'[]'::jsonb) into result from (
 select h.id,h.pursuit_id,h.reason,h.reason_codes,h.decided_at,h.decided_by,h.opportunity_snapshot,h.review_snapshot,h.match_version,
 array(select unnest(h.match_features) intersect select unnest(features)) as matched_features
 from public.pursuit_decision_history h where h.organization_id=org and h.decision='no_bid' and h.match_features && features and h.opportunity_snapshot->>'id'<>target::text
 order by cardinality(array(select unnest(h.match_features) intersect select unnest(features))) desc,h.decided_at desc,h.id limit 5
 ) matches;
 return jsonb_build_object('matches',result,'context',context,'version','contractor-memory-v1');
end $$;

create function public.opportunity_decision_features(org uuid,target uuid) returns text[]
language plpgsql stable security definer set search_path='' as $$
declare o public.opportunities; source_text text;
begin
 if auth.uid() is null or private.member_role(org) is null then raise exception 'Workspace access required' using errcode='42501'; end if;
 select * into o from public.opportunities where organization_id=org and id=target;
 if not found then raise exception 'Opportunity unavailable' using errcode='42501'; end if;
 select concat_ws(' ',o.title,o.summary,string_agg(r.requirement,' ' order by r.id)) into source_text from public.pursuit_requirements r join public.pursuits p on p.organization_id=r.organization_id and p.id=r.pursuit_id where p.organization_id=org and p.opportunity_id=target and r.archived_at is null;
 return private.decision_match_features(o.buyer,source_text);
end $$;
revoke all on function public.opportunity_decision_features(uuid,uuid) from public,anon,authenticated;
grant execute on function public.opportunity_decision_features(uuid,uuid) to authenticated;
revoke all on function public.similar_no_bid_decisions(uuid,uuid) from public,anon,authenticated;
grant execute on function public.similar_no_bid_decisions(uuid,uuid) to authenticated;

-- The new entry point requires structured no-bid reasons; the older RPC remains
-- compatible for deployments that have not enabled the feature yet.
create function public.record_company_decision(org uuid,pursuit uuid,expected_version timestamptz,expected_context text,outcome text,rationale text,limits text,reason_codes text[],pursuit_hours numeric default null) returns uuid
language plpgsql security invoker set search_path='' as $$
begin
 if outcome='no_bid' and coalesce(cardinality(reason_codes),0)=0 then raise exception 'Select at least one no-bid reason'; end if;
 if cardinality(reason_codes)<>(select count(distinct code) from unnest(reason_codes) code) then raise exception 'Choose distinct reason codes'; end if;
 if not exists(select 1 from public.company_profiles where organization_id=org) then raise exception 'Create the Company Passport first'; end if;
 return public.record_pursuit_decision(org,pursuit,expected_version,expected_context,outcome,rationale,limits,reason_codes,pursuit_hours);
end $$;
revoke all on function public.record_company_decision(uuid,uuid,timestamptz,text,text,text,text,text[],numeric) from public,anon,authenticated;
grant execute on function public.record_company_decision(uuid,uuid,timestamptz,text,text,text,text,text[],numeric) to authenticated;

create function public.current_decision_memory_reviews(org uuid,target uuid,decision_ids uuid[]) returns setof public.decision_memory_reviews
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or private.member_role(org) is null or coalesce(cardinality(decision_ids),0)>5 then raise exception 'Workspace and bounded decisions required'; end if;
 return query select distinct on (r.decision_id,r.reason_code) r.* from public.decision_memory_reviews r
 where r.organization_id=org and r.opportunity_id=target and r.decision_id=any(decision_ids)
 order by r.decision_id,r.reason_code,r.sequence desc;
end $$;
revoke all on function public.current_decision_memory_reviews(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.current_decision_memory_reviews(uuid,uuid,uuid[]) to authenticated;
