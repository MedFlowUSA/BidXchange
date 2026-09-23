-- Public solicitation excerpts only. Candidate comparison never changes a requirement.
create table public.amendment_comparisons(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 opportunity_id uuid not null, label text not null check(length(btrim(label)) between 1 and 200),
 original_url text not null, amended_url text not null,
 original_text text not null check(length(btrim(original_text)) between 1 and 24000),
 amended_text text not null check(length(btrim(amended_text)) between 1 and 24000),
 original_hash text not null, amended_hash text not null,
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items)=6 and octet_length(items::text)<=250000),
 requirements jsonb not null, context_token text not null,
 method text not null default 'contractor-clause-diff-v1' check(method='contractor-clause-diff-v1'),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,id), foreign key(organization_id,opportunity_id) references public.opportunities(organization_id,id),
 check(original_url ~ '^https://[^[:space:]]+$' and original_url !~ '^https://[^/]*@' and length(original_url)<=2000),
 check(amended_url ~ '^https://[^[:space:]]+$' and amended_url !~ '^https://[^/]*@' and length(amended_url)<=2000)
);
create table public.amendment_comparison_reviews(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 comparison_id uuid not null unique, outcome text not null check(outcome in ('confirmed','dismissed')),
 note text not null check(length(btrim(note)) between 1 and 4000),
 affected_requirement_ids uuid[] not null default '{}', amendment_id uuid references public.opportunity_amendments(id),
 reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,comparison_id) references public.amendment_comparisons(organization_id,id),
 check((outcome='confirmed')=(amendment_id is not null))
);
create index amendment_comparison_opportunity on public.amendment_comparisons(organization_id,opportunity_id,created_at desc);
alter table public.amendment_comparisons enable row level security;
alter table public.amendment_comparison_reviews enable row level security;
revoke all on public.amendment_comparisons,public.amendment_comparison_reviews from public,anon,authenticated;
grant select on public.amendment_comparisons,public.amendment_comparison_reviews to authenticated;
create policy capture_read on public.amendment_comparisons for select to authenticated using(private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy capture_read on public.amendment_comparison_reviews for select to authenticated using(private.member_role(organization_id) in ('organization_admin','capture_manager'));
create function private.audit_amendment_comparison() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(organization_id,actor_user_id,entity_table,entity_id,action,next_record)
 values(new.organization_id,auth.uid(),TG_TABLE_NAME,new.id,'INSERT',jsonb_build_object('id',new.id,'organization_id',new.organization_id));
 return new;
end $$;
revoke all on function private.audit_amendment_comparison() from public,anon,authenticated;
create trigger audit_comparison after insert on public.amendment_comparisons for each row execute function private.audit_amendment_comparison();
create trigger audit_comparison_review after insert on public.amendment_comparison_reviews for each row execute function private.audit_amendment_comparison();

create function public.save_amendment_comparison(org uuid,target uuid,expected_context text,title text,old_url text,new_url text,old_text text,new_text text,candidates jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; snapshot jsonb; item jsonb; clause jsonb;
begin
 if coalesce(private.member_role(org)::text,'') not in ('organization_admin','capture_manager') then raise exception 'Capture access required'; end if;
 perform 1 from public.opportunities where organization_id=org and id=target for update;
 if not found then raise exception 'Opportunity unavailable'; end if;
 if expected_context is distinct from public.decision_memory_context(org,target) then raise exception 'Records changed; refresh comparison'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'text',r.requirement,'status',r.status,'version',r.updated_at) order by r.id),'[]') into snapshot
 from public.pursuit_requirements r join public.pursuits p on p.organization_id=r.organization_id and p.id=r.pursuit_id where p.organization_id=org and p.opportunity_id=target;
 if jsonb_array_length(snapshot)>200 then raise exception 'Compare a smaller register manually'; end if;
 if candidates is null or jsonb_typeof(candidates)<>'array' or jsonb_array_length(candidates)<>6 then raise exception 'Invalid candidate comparison'; end if;
 if (select count(distinct x->>'field') from jsonb_array_elements(candidates) x)<>6 then raise exception 'Duplicate field'; end if;
 for item in select * from jsonb_array_elements(candidates) loop
  if coalesce(item->>'field','') not in ('license','bond','insurance','deadline','meeting','scope') or coalesce(item->>'status','') not in ('unknown','changed','unchanged') or length(coalesce(item->>'label','')) not between 1 and 100 or coalesce(jsonb_typeof(item->'before'),'')<>'array' or coalesce(jsonb_typeof(item->'after'),'')<>'array' or coalesce(jsonb_typeof(item->'suggestedRequirementIds'),'')<>'array' then raise exception 'Invalid candidate field'; end if;
  for clause in select * from jsonb_array_elements(item->'before') loop
   if coalesce(clause->>'line','') !~ '^[1-9][0-9]{0,5}$' or clause->>'text' is distinct from split_part(replace(old_text,E'\r\n',E'\n'),E'\n',(clause->>'line')::int) then raise exception 'Original quotation must match source'; end if;
  end loop;
  for clause in select * from jsonb_array_elements(item->'after') loop
   if coalesce(clause->>'line','') !~ '^[1-9][0-9]{0,5}$' or clause->>'text' is distinct from split_part(replace(new_text,E'\r\n',E'\n'),E'\n',(clause->>'line')::int) then raise exception 'Amended quotation must match source'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements_text(item->'suggestedRequirementIds') a where not exists(select 1 from jsonb_array_elements(snapshot) r where r->>'id'=a)) then raise exception 'Candidate requirement unavailable'; end if;
 end loop;
 if not public.consume_admin_mutation() then raise exception 'Mutation limit reached'; end if;
 insert into public.amendment_comparisons(organization_id,opportunity_id,label,original_url,amended_url,original_text,amended_text,original_hash,amended_hash,items,requirements,context_token,created_by)
 values(org,target,title,old_url,new_url,old_text,new_text,md5(old_text),md5(new_text),candidates,snapshot,expected_context,auth.uid()) returning id into result;
 return result;
end $$;
revoke all on function public.save_amendment_comparison(uuid,uuid,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_amendment_comparison(uuid,uuid,text,text,text,text,text,text,jsonb) to authenticated;

create function public.confirm_amendment_comparison(org uuid,comparison uuid,choice text,explanation text,affected uuid[],acknowledged boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.amendment_comparisons; prior public.amendment_comparison_reviews; amendment uuid; result uuid;
begin
 -- Match the existing capture role; hold membership rows during the write.
 perform 1 from public.organization_memberships where organization_id=org for share;
 if coalesce(private.member_role(org)::text,'') not in ('organization_admin','capture_manager') then raise exception 'Capture access required'; end if;
 select * into c from public.amendment_comparisons where organization_id=org and id=comparison for update;
 if not found then raise exception 'Comparison unavailable'; end if;
 if choice not in ('confirmed','dismissed') or choice is null or acknowledged is distinct from true or length(btrim(coalesce(explanation,''))) not between 1 and 4000 or affected is null or cardinality(affected)>200 then raise exception 'Human review required'; end if;
 select * into prior from public.amendment_comparison_reviews where comparison_id=comparison;
 if found then
   if prior.outcome=choice and prior.note=explanation and prior.affected_requirement_ids=affected and prior.reviewed_by=auth.uid() then return prior.id; end if;
   raise exception 'Comparison already reviewed';
 end if;
 perform 1 from public.opportunities where organization_id=org and id=c.opportunity_id for update;
 perform 1 from public.pursuits where organization_id=org and opportunity_id=c.opportunity_id for update;
 perform 1 from public.pursuit_requirements r where r.organization_id=org and exists(select 1 from public.pursuits p where p.id=r.pursuit_id and p.organization_id=org and p.opportunity_id=c.opportunity_id) for update;
 if choice='confirmed' and c.context_token is distinct from public.decision_memory_context(org,c.opportunity_id) then raise exception 'Records changed; create a new comparison'; end if;
 if exists(select 1 from unnest(affected) a where not exists(select 1 from jsonb_array_elements(c.requirements) r where r->>'id'=a::text)) or cardinality(affected)<>(select count(distinct a) from unnest(affected) a) then raise exception 'Requirement not in comparison'; end if;
 if not public.consume_admin_mutation() then raise exception 'Mutation limit reached'; end if;
 if choice='confirmed' then
   -- Existing amendment trigger conservatively invalidates ALL related requirements.
   -- Keep reviewed=false: amendment review, register sign-off and decisions stay separate.
   insert into public.opportunity_amendments(organization_id,opportunity_id,label,source_url,summary,notice_text)
   values(org,c.opportunity_id,c.label,c.amended_url,explanation,c.amended_text) returning id into amendment;
 end if;
 insert into public.amendment_comparison_reviews(organization_id,comparison_id,outcome,note,affected_requirement_ids,amendment_id,reviewed_by)
 values(org,comparison,choice,explanation,affected,amendment,auth.uid()) returning id into result;
 return result;
end $$;
revoke all on function public.confirm_amendment_comparison(uuid,uuid,text,text,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.confirm_amendment_comparison(uuid,uuid,text,text,uuid[],boolean) to authenticated;
