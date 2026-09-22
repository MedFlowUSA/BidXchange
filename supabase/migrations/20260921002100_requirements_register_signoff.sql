-- A version-bound human register sign-off, separate from individual findings.
create table public.requirements_register_signoffs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null, context_token text not null, note text not null check(length(btrim(note)) between 1 and 4000),
 signed_off_by uuid not null references auth.users(id), signed_off_at timestamptz not null default clock_timestamp(),
 requirement_count integer not null, blocker_count integer not null, clarification_count integer not null,
 snapshot jsonb not null,
 foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id)
);
alter table public.requirements_register_signoffs enable row level security;
revoke all on public.requirements_register_signoffs from public,anon,authenticated;
grant select on public.requirements_register_signoffs to authenticated;
create policy member_read on public.requirements_register_signoffs for select to authenticated using(private.member_role(organization_id) is not null);
create index register_signoff_pursuit on public.requirements_register_signoffs(organization_id,pursuit_id,signed_off_at desc);
create trigger audit_signoff after insert on public.requirements_register_signoffs for each row execute function private.audit_change();

create function public.sign_off_requirements_register(org uuid,pursuit uuid,expected_context text,review_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare context text; result uuid; rows jsonb; count_rows integer; blockers integer; clarifications integer;
begin
 if auth.uid() is null or coalesce(private.member_role(org)::text,'') not in ('organization_admin','executive_approver') then raise exception 'Authorized human reviewer required' using errcode='42501'; end if;
 if review_note is null or length(btrim(review_note)) not between 1 and 4000 then raise exception 'Register review note required'; end if;
 perform 1 from public.pursuits where organization_id=org and id=pursuit for update;
 if not found then raise exception 'Pursuit unavailable' using errcode='42501'; end if;
 context:=public.pursuit_decision_context(org,pursuit);
 if context is distinct from expected_context then raise exception 'Register changed; refresh before signing off'; end if;
 select count(*),count(*) filter(where case when x.review_current then x.disposition='blocked' else r.status='blocked' end),count(*) filter(where case when x.review_current then x.disposition='awaiting_clarification' else r.status='missing_information' end),
 jsonb_agg(jsonb_build_object('id',r.id,'text',r.requirement,'citation',r.citation,'status',r.status,'version',r.updated_at,'human_finding',case when x.review_current then x.disposition else null end,'finding_id',x.id) order by r.id)
 into count_rows,blockers,clarifications,rows from public.pursuit_requirements r left join public.current_requirement_resolutions x on x.organization_id=r.organization_id and x.requirement_id=r.id where r.organization_id=org and r.pursuit_id=pursuit;
 if count_rows=0 or count_rows>500 then raise exception 'Review a nonempty bounded requirements register'; end if;
 if exists(select 1 from public.pursuit_requirements r where r.organization_id=org and r.pursuit_id=pursuit and nullif(btrim(r.citation),'') is null) then raise exception 'Every requirement needs a source citation'; end if;
 if not public.consume_admin_mutation() then raise exception 'Review rate limit reached'; end if;
 insert into public.requirements_register_signoffs(organization_id,pursuit_id,context_token,note,signed_off_by,requirement_count,blocker_count,clarification_count,snapshot)
 values(org,pursuit,context,btrim(review_note),auth.uid(),count_rows,blockers,clarifications,rows) returning id into result;
 return result;
end $$;
revoke all on function public.sign_off_requirements_register(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.sign_off_requirements_register(uuid,uuid,text,text) to authenticated;

-- Retain the existing decision implementation privately; no alternate public bypass.
alter table public.pursuit_decision_history
 add column preliminary_state text check(preliminary_state in ('draft','leaning_bid','leaning_pass')),
 add column reason_codes text[] not null default '{}',
 add column estimated_pursuit_hours numeric check(estimated_pursuit_hours>=0 and estimated_pursuit_hours<=100000),
 add column register_signoff_id uuid references public.requirements_register_signoffs(id),
 add column review_snapshot jsonb;
create trigger audit_decision_metadata after update on public.pursuit_decision_history for each row execute function private.audit_change();
alter function public.record_pursuit_decision(uuid,uuid,timestamptz,text,text,text,text) set schema private;
revoke all on function private.record_pursuit_decision(uuid,uuid,timestamptz,text,text,text,text) from public,anon,authenticated;
create function public.record_pursuit_decision(org uuid,pursuit uuid,expected_version timestamptz,expected_context text,outcome text,rationale text,limits text,reason_codes text[] default '{}',pursuit_hours numeric default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare current_context text; result uuid; signoff public.requirements_register_signoffs; snapshot jsonb;
begin
 if auth.uid() is null or coalesce(private.member_role(org)::text,'') not in ('organization_admin','executive_approver') then raise exception 'Authorized human decision maker required' using errcode='42501'; end if;
 perform 1 from public.pursuits where organization_id=org and id=pursuit for update;
 current_context:=public.pursuit_decision_context(org,pursuit);
 if current_context is distinct from expected_context then raise exception 'Review context changed; reload before deciding'; end if;
 if outcome is null or outcome not in ('bid','no_bid','pending','draft','leaning_bid','leaning_pass') then raise exception 'Choose a decision'; end if;
 if reason_codes is null or cardinality(reason_codes)>16 or array_position(reason_codes,null) is not null or not reason_codes <@ array['license','bond','insurance','capacity','territory','set_aside','margin_unknown','deadline','site_visit','past_performance','relationship','strategic','submission_burden','other']::text[] then raise exception 'Invalid reason codes'; end if;
 if pursuit_hours is not null and (pursuit_hours<0 or pursuit_hours>100000 or pursuit_hours='NaN'::numeric) then raise exception 'Invalid pursuit hours'; end if;
 if outcome in ('bid','no_bid') and not exists(select 1 from public.requirements_register_signoffs s where s.organization_id=org and s.pursuit_id=pursuit and s.context_token=current_context and private.member_role(s.organization_id) is not null
   and exists(select 1 from public.organization_memberships m where m.organization_id=org and m.user_id=s.signed_off_by and m.status='active' and m.role in ('organization_admin','executive_approver'))) then
   raise exception 'Current human Requirements Register sign-off required';
 end if;
 select * into signoff from public.requirements_register_signoffs s where s.organization_id=org and s.pursuit_id=pursuit and s.context_token=current_context order by s.signed_off_at desc limit 1;
 select jsonb_build_object('as_of',clock_timestamp(),'context',current_context,'requirements',coalesce(signoff.snapshot,'[]'::jsonb),'blockers',signoff.blocker_count,'clarifications',signoff.clarification_count,'due_at',o.official_deadline,'timezone',o.deadline_timezone,
 'evidence_current', (select count(*) from public.current_evidence_use_reviews v join public.pursuit_requirements r on r.id=v.requirement_id and r.organization_id=v.organization_id where r.organization_id=org and r.pursuit_id=pursuit and v.approval_current),
 'evidence_needing_review',(select count(*) from public.current_evidence_use_reviews v join public.pursuit_requirements r on r.id=v.requirement_id and r.organization_id=v.organization_id where r.organization_id=org and r.pursuit_id=pursuit and not v.approval_current)) into snapshot from public.pursuits p join public.opportunities o on o.id=p.opportunity_id and o.organization_id=p.organization_id where p.organization_id=org and p.id=pursuit;
 result:=private.record_pursuit_decision(org,pursuit,expected_version,expected_context,case when outcome in ('draft','leaning_bid','leaning_pass') then 'pending' else outcome end,rationale,limits);
 update public.pursuit_decision_history h set preliminary_state=case when outcome in ('draft','leaning_bid','leaning_pass') then outcome else null end,reason_codes=record_pursuit_decision.reason_codes,estimated_pursuit_hours=pursuit_hours,register_signoff_id=signoff.id,review_snapshot=snapshot where h.id=result and h.organization_id=org;
 return result;
end $$;
revoke all on function public.record_pursuit_decision(uuid,uuid,timestamptz,text,text,text,text,text[],numeric) from public,anon,authenticated;
grant execute on function public.record_pursuit_decision(uuid,uuid,timestamptz,text,text,text,text,text[],numeric) to authenticated;
