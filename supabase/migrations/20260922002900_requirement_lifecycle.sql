-- Reversible requirement corrections. Existing records and relationships are retained.
alter table public.pursuit_requirements
 add column archived_at timestamptz,
 add column archived_by uuid references auth.users(id),
 add column archive_reason text,
 add column merged_into_id uuid,
 add constraint requirement_archive_metadata check (
   (archived_at is null and archived_by is null and archive_reason is null and merged_into_id is null)
   or (archived_at is not null and archived_by is not null and length(btrim(archive_reason)) between 1 and 2000)),
 add constraint requirement_merge_not_self check(merged_into_id is distinct from id),
 add foreign key(organization_id,merged_into_id) references public.pursuit_requirements(organization_id,id);
create index requirements_active_pursuit on public.pursuit_requirements(organization_id,pursuit_id,id) where archived_at is null;
create index requirements_archived_pursuit on public.pursuit_requirements(organization_id,pursuit_id,archived_at desc) where archived_at is not null;

-- Archive/restore metadata can only be written by the bounded lifecycle function.
revoke delete on public.pursuit_requirements from authenticated;
create function private.guard_requirement_lifecycle() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Archive requirements instead of deleting their history'; end if;
 if tg_op='INSERT' then
   if new.archived_at is not null or new.merged_into_id is not null then raise exception 'New requirements must be active'; end if;
 elsif tg_op='UPDATE' then
   if new.pursuit_id is distinct from old.pursuit_id then raise exception 'Requirement pursuit is immutable'; end if;
   if old.archived_at is not null and new.archived_at is not null then raise exception 'Restore the archived requirement before editing'; end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_requirement_lifecycle() from public,anon,authenticated;
create trigger guard_requirement_lifecycle before insert or update or delete on public.pursuit_requirements for each row execute function private.guard_requirement_lifecycle();

create table public.requirement_lifecycle_history (
 id uuid primary key default gen_random_uuid(),
 sequence bigint generated always as identity unique,
 organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null,
 requirement_id uuid not null,
 target_id uuid,
 action text not null check(action in ('archive','restore','merge')),
 reason text not null check(length(btrim(reason)) between 1 and 2000),
 before_source jsonb not null, before_target jsonb, after_source jsonb not null, after_target jsonb,
 recorded_by uuid not null references auth.users(id),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id),
 foreign key(organization_id,requirement_id) references public.pursuit_requirements(organization_id,id),
 foreign key(organization_id,target_id) references public.pursuit_requirements(organization_id,id)
);
alter table public.requirement_lifecycle_history enable row level security;
revoke all on public.requirement_lifecycle_history from public,anon,authenticated;
revoke all on sequence public.requirement_lifecycle_history_sequence_seq from public,anon,authenticated;
grant select on public.requirement_lifecycle_history to authenticated;
create policy member_read on public.requirement_lifecycle_history for select to authenticated using(private.member_role(organization_id) is not null);
create index requirement_lifecycle_pursuit on public.requirement_lifecycle_history(organization_id,pursuit_id,sequence desc);
create trigger audit_lifecycle after insert on public.requirement_lifecycle_history for each row execute function private.audit_change();
create trigger immutable_lifecycle before update or delete on public.requirement_lifecycle_history for each row execute function private.immutable_response_history();

create function public.change_requirement_lifecycle(
 org uuid,pursuit uuid,source uuid,expected_source timestamptz,operation text,rationale text,
 target uuid default null,expected_target timestamptz default null,merged_text text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.pursuit_requirements; t public.pursuit_requirements; updated_source public.pursuit_requirements; updated_target public.pursuit_requirements; citation_text text; result uuid;
begin
 if auth.uid() is null or coalesce(private.member_role(org)::text,'') not in ('organization_admin','capture_manager') then raise exception 'Capture access required' using errcode='42501'; end if;
 if operation is null or operation not in ('archive','restore','merge') or rationale is null or length(btrim(rationale)) not between 1 and 2000 then raise exception 'Correction action and reason required'; end if;
 if operation<>'merge' and (target is not null or expected_target is not null or merged_text is not null) then raise exception 'Target fields are only valid for merge'; end if;
 perform 1 from public.pursuits p where p.organization_id=org and p.id=pursuit for update;
 if not found then raise exception 'Pursuit unavailable' using errcode='42501'; end if;
 -- Stable lock order prevents two opposing merges from losing an edit.
 perform 1 from public.pursuit_requirements r where r.organization_id=org and r.pursuit_id=pursuit and r.id in (source,target) order by r.id for update;
 select * into s from public.pursuit_requirements r where r.organization_id=org and r.pursuit_id=pursuit and r.id=source;
 if not found then raise exception 'Requirement unavailable' using errcode='42501'; end if;
 if expected_source is null or s.updated_at is distinct from expected_source then raise exception 'Requirement changed; reload before correcting'; end if;
 if operation='restore' then
   if s.archived_at is null then raise exception 'Requirement is already active'; end if;
 else
   if s.archived_at is not null then raise exception 'Requirement is already archived'; end if;
 end if;
 if operation='merge' then
   if target is null or target=source or expected_target is null or merged_text is null or length(btrim(merged_text)) not between 1 and 4000 then raise exception 'Choose a different active target and bounded combined wording'; end if;
   select * into t from public.pursuit_requirements r where r.organization_id=org and r.pursuit_id=pursuit and r.id=target;
   if not found or t.archived_at is not null then raise exception 'Active target in the same pursuit required'; end if;
   if t.updated_at is distinct from expected_target then raise exception 'Merge target changed; reload before correcting'; end if;
   if nullif(btrim(s.citation),'') is null or nullif(btrim(t.citation),'') is null then raise exception 'Both source citations are required for a merge'; end if;
   citation_text:=t.citation||E'\nMerged source '||s.id::text||': '||s.citation;
   if length(citation_text)>2000 then raise exception 'Combined citations exceed 2000 characters; keep separate requirements'; end if;
 end if;
 if not public.consume_admin_mutation() then raise exception 'Please wait before trying again'; end if;
 if operation='restore' then
   update public.pursuit_requirements r set archived_at=null,archived_by=null,archive_reason=null,merged_into_id=null,status='needs_review',evidence_freshness_token=null
     where r.organization_id=org and r.id=source returning * into updated_source;
 else
   if operation='merge' then
     update public.pursuit_requirements r set requirement=btrim(merged_text),citation=citation_text,status='needs_review',evidence_freshness_token=null
       where r.organization_id=org and r.id=target returning * into updated_target;
   end if;
   update public.pursuit_requirements r set archived_at=clock_timestamp(),archived_by=auth.uid(),archive_reason=btrim(rationale),merged_into_id=target,status='needs_review'
     where r.organization_id=org and r.id=source returning * into updated_source;
 end if;
 -- Shared requirement snapshots only; never copy private evidence values or approvals.
 insert into public.requirement_lifecycle_history(organization_id,pursuit_id,requirement_id,target_id,action,reason,before_source,before_target,after_source,after_target,recorded_by)
 values(org,pursuit,source,target,operation,btrim(rationale),to_jsonb(s),case when operation='merge' then to_jsonb(t) else null end,to_jsonb(updated_source),case when operation='merge' then to_jsonb(updated_target) else null end,auth.uid()) returning id into result;
 return result;
end $$;
revoke all on function public.change_requirement_lifecycle(uuid,uuid,uuid,timestamptz,text,text,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.change_requirement_lifecycle(uuid,uuid,uuid,timestamptz,text,text,uuid,timestamptz,text) to authenticated;

-- Archive-aware extensions of existing workflows; all other gates are preserved.
create or replace function public.sign_off_requirements_register(org uuid,pursuit uuid,expected_context text,review_note text) returns uuid
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
 into count_rows,blockers,clarifications,rows from public.pursuit_requirements r left join public.current_requirement_resolutions x on x.organization_id=r.organization_id and x.requirement_id=r.id where r.organization_id=org and r.pursuit_id=pursuit and r.archived_at is null;
 if count_rows=0 or count_rows>500 then raise exception 'Review a nonempty bounded requirements register'; end if;
 if exists(select 1 from public.pursuit_requirements r where r.organization_id=org and r.pursuit_id=pursuit and r.archived_at is null and nullif(btrim(r.citation),'') is null) then raise exception 'Every requirement needs a source citation'; end if;
 if not public.consume_admin_mutation() then raise exception 'Review rate limit reached'; end if;
 insert into public.requirements_register_signoffs(organization_id,pursuit_id,context_token,note,signed_off_by,requirement_count,blocker_count,clarification_count,snapshot)
 values(org,pursuit,context,btrim(review_note),auth.uid(),count_rows,blockers,clarifications,rows) returning id into result;
 return result;
end $$;
create or replace function public.freeze_response_release(org uuid,pursuit uuid,package uuid,expected_version timestamptz,expected_context text,checklist jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.proposal_sections; context text; snap jsonb; content jsonb; result uuid; item jsonb; k text;
begin
 if auth.uid() is null or coalesce(private.member_role(org)::text,'') not in ('organization_admin','capture_manager') then raise exception 'Capture access required' using errcode='42501'; end if;
 select * into p from public.proposal_sections where organization_id=org and pursuit_id=pursuit and id=package for update;
 if not found or p.status<>'draft' or p.updated_at is distinct from expected_version then raise exception 'Saved response changed or unavailable'; end if;
 content:=p.content::jsonb;
 if content->>'schema' is distinct from '1' or jsonb_typeof(content->'answers') is distinct from 'array' or length(p.content)>100000 then raise exception 'Unsupported response'; end if;
 if jsonb_array_length(content->'answers')>100 or (select count(*) from public.pursuit_requirements where organization_id=org and pursuit_id=pursuit and archived_at is null)>100
 or exists(select 1 from jsonb_array_elements(content->'answers') a group by a->>'requirementId' having count(*)>1) then raise exception 'Bounded unique response answers required'; end if;
 for item in select value from jsonb_array_elements(content->'answers') loop
  if jsonb_typeof(item) is distinct from 'object' or length(coalesce(item->>'text',''))>4000 or nullif(item->>'requirementVersion','') is null
    or not exists(select 1 from public.pursuit_requirements where organization_id=org and pursuit_id=pursuit and archived_at is null and id=(item->>'requirementId')::uuid) then raise exception 'Invalid response answer'; end if;
  perform (item->>'requirementVersion')::timestamptz;
 end loop;
 context:=public.response_release_context(org,pursuit);
 if context is distinct from expected_context then raise exception 'Review context changed'; end if;
 if checklist is null or jsonb_typeof(checklist)<>'object' or octet_length(checklist::text)>40000 then raise exception 'Bounded checklist required'; end if;
 if exists(select 1 from jsonb_object_keys(checklist) field where field not in ('instructions','attachments','forms','signatures','certifications','amendments','pricing','filenames','formats','limits','source_review','method','portal','source_version','reviewed_at','submitter','files')) then raise exception 'Unsupported checklist fields'; end if;
 foreach k in array array['instructions','attachments','forms','signatures','certifications','amendments','pricing','filenames','formats','limits','source_review'] loop
  item:=checklist->k;
  if item is null or jsonb_typeof(item)<>'object' or coalesce(item->>'status','') not in ('confirmed','missing','needs_review','not_applicable','unknown') or length(coalesce(item->>'reference',''))>2000
    or ((item->>'status') in ('confirmed','not_applicable') and length(btrim(coalesce(item->>'reference','')))<1) then raise exception 'Every checklist item needs an explicit status and confirmation reference'; end if;
  if exists(select 1 from jsonb_object_keys(item) key where key not in ('status','reference')) then raise exception 'Unsupported checklist item fields'; end if;
 end loop;
 if length(btrim(coalesce(checklist->>'method',''))) not between 1 and 200 or length(btrim(coalesce(checklist->>'portal',''))) not between 1 and 2000
 or length(btrim(coalesce(checklist->>'source_version',''))) not between 1 and 500
 or coalesce(checklist->>'reviewed_at','')='' or (checklist->>'reviewed_at')::timestamptz>clock_timestamp()
 or not exists(select 1 from public.organization_memberships m where m.organization_id=org and m.user_id=(checklist->>'submitter')::uuid and m.status='active' and m.role in ('organization_admin','executive_approver','capture_manager')) then raise exception 'Submission instructions, source review and active authorized submitter required'; end if;
 if jsonb_typeof(checklist->'files') is distinct from 'array' or jsonb_array_length(checklist->'files') not between 1 and 30 then raise exception 'Final file manifest required'; end if;
 for item in select value from jsonb_array_elements(checklist->'files') loop
  if jsonb_typeof(item) is distinct from 'object' or exists(select 1 from jsonb_object_keys(item) key where key not in ('name','sha256','reference')) then raise exception 'Unsupported file fields'; end if;
  if length(btrim(coalesce(item->>'name',''))) not between 1 and 200 or coalesce(item->>'sha256','') !~ '^[a-f0-9]{64}$' or length(btrim(coalesce(item->>'reference',''))) not between 1 and 1000 then raise exception 'File name, SHA-256 and bounded reference required'; end if;
 end loop;
 -- Snapshot only existing shared source fields. No restricted fact values copied.
 snap:=jsonb_build_object('title',p.title,'response',content,'checklist',checklist,
 'opportunity',(select jsonb_build_object('title',o.title,'buyer',o.buyer,'solicitation',o.solicitation_number,'source_url',o.source_url,'source_note',o.source_note,'deadline',o.official_deadline,'timezone',o.deadline_timezone) from public.opportunities o join public.pursuits pu on pu.organization_id=o.organization_id and pu.opportunity_id=o.id where pu.organization_id=org and pu.id=pursuit),
 'company',(select jsonb_build_object('legal_name',o.legal_name,'operating_name',o.operating_name,'website',o.website) from public.organizations o where o.id=org),
 'requirements',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'text',r.requirement,'citation',r.citation,'owner',r.owner_user_id,'version',r.updated_at,'finding',h.disposition,'review_current',h.review_current) order by r.id),'[]') from public.pursuit_requirements r left join public.current_requirement_resolutions h on h.organization_id=r.organization_id and h.requirement_id=r.id where r.organization_id=org and r.pursuit_id=pursuit and r.archived_at is null),
 'bid_decision',(select jsonb_build_object('id',h.id,'decision',h.decision,'actor',h.decided_by,'at',h.decided_at,'conditions',h.conditions,'reason',h.reason) from public.pursuit_decision_history h where h.organization_id=org and h.pursuit_id=pursuit order by h.decided_at desc,h.id desc limit 1));
 if not public.consume_admin_mutation() then raise exception 'Please wait before trying again'; end if;
 insert into public.response_release_versions(organization_id,pursuit_id,package_id,package_version,context_token,checksum,snapshot,created_by)
 values(org,pursuit,package,p.updated_at,context,encode(sha256(convert_to(snap::text,'UTF8')),'hex'),snap,auth.uid())
 on conflict(package_id,package_version,context_token,checksum) do nothing returning id into result;
 if result is null then select id into result from public.response_release_versions where package_id=package and package_version=p.updated_at and context_token=context and checksum=encode(sha256(convert_to(snap::text,'UTF8')),'hex'); end if;
 return result;
end $$;
create or replace function public.response_release_status(org uuid,release uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.response_release_versions; p public.proposal_sections; blockers jsonb:='[]'; approvals jsonb:='{}'; ids jsonb:='{}'; gate_record public.response_approval_history; k text; item jsonb; req record; ans jsonb; current_version boolean; state text; submitted uuid; pending_source boolean:=false;
begin
 if auth.uid() is null or private.member_role(org) is null then raise exception 'Workspace access required' using errcode='42501'; end if;
 select * into v from public.response_release_versions where organization_id=org and id=release;
 if not found then raise exception 'Release unavailable' using errcode='42501'; end if;
 select * into p from public.proposal_sections where organization_id=org and id=v.package_id and pursuit_id=v.pursuit_id;
 current_version:=p.id is not null and p.status='draft' and p.updated_at=v.package_version and p.content::jsonb=v.snapshot->'response' and p.title=v.snapshot->>'title' and v.context_token=public.response_release_context(org,v.pursuit_id)
  and v.id=(select id from public.response_release_versions where organization_id=org and package_id=v.package_id order by sequence desc limit 1);
 if not current_version then blockers:=blockers||jsonb_build_array('Response, checklist, sources, membership or review date changed. Prepare a new version.'); end if;
 if not exists(select 1 from public.pursuit_decision_history h where h.organization_id=org and h.pursuit_id=v.pursuit_id and h.decision='bid' and h.context_token=public.pursuit_decision_context(org,v.pursuit_id) and h.id=(select h2.id from public.pursuit_decision_history h2 where h2.organization_id=org and h2.pursuit_id=v.pursuit_id order by h2.decided_at desc,h2.id desc limit 1)) then blockers:=blockers||jsonb_build_array('Current human Pursue bid decision required.'); end if;
 if nullif(btrim(v.snapshot#>>'{opportunity,solicitation}'),'') is null or (nullif(btrim(v.snapshot#>>'{opportunity,source_url}'),'') is null and nullif(btrim(v.snapshot#>>'{opportunity,source_note}'),'') is null) then blockers:=blockers||jsonb_build_array('Official source and solicitation number required.'); end if;
 if nullif(v.snapshot#>>'{opportunity,deadline}','') is null or nullif(v.snapshot#>>'{opportunity,timezone}','') is null then blockers:=blockers||jsonb_build_array('Official deadline and timezone required.');
 elsif (v.snapshot#>>'{opportunity,deadline}')::timestamptz<=clock_timestamp() then blockers:=blockers||jsonb_build_array('The recorded deadline has passed; verify buyer instructions before proceeding.'); end if;
 if jsonb_array_length(v.snapshot->'requirements')=0 then blockers:=blockers||jsonb_build_array('No requirements recorded.'); end if;
 if v.snapshot#>>'{response,context}' is distinct from public.pursuit_decision_context(org,v.pursuit_id) then blockers:=blockers||jsonb_build_array('Saved response context is stale. Reconcile and save the response before preparing a new version.'); end if;
 if to_regclass('public.source_inbox') is not null then
  execute 'select exists(select 1 from public.source_inbox i join public.pursuits pu on pu.organization_id=i.organization_id and pu.opportunity_id=i.opportunity_id where pu.organization_id=$1 and pu.id=$2 and i.change_pending)' into pending_source using org,v.pursuit_id;
 end if;
 if pending_source then blockers:=blockers||jsonb_build_array('An observed official source change awaits human review.'); end if;
 if coalesce(v.snapshot#>>'{response,summary}','') !~ '\S' or (v.snapshot#>>'{response,summary}') ~* '(\[(human input required|complete|confirm|describe|check|not recorded|answer not supplied|response overview not supplied|insert|add)\M|\m(TODO|TBD)\M)' then blockers:=blockers||jsonb_build_array('Complete the response overview and remove placeholders.'); end if;
 for req in select r.*,h.disposition,h.review_current from public.pursuit_requirements r left join public.current_requirement_resolutions h on h.organization_id=r.organization_id and h.requirement_id=r.id where r.organization_id=org and r.pursuit_id=v.pursuit_id and r.archived_at is null loop
  if nullif(btrim(req.citation),'') is null or req.owner_user_id is null or not exists(select 1 from public.organization_memberships m where m.organization_id=org and m.user_id=req.owner_user_id and m.status='active') or req.review_current is distinct from true or coalesce(req.disposition,'') not in ('supported','waived','not_applicable') then blockers:=blockers||jsonb_build_array('Requirement '||req.id||': current supported, not-applicable or buyer-waiver finding, citation and active owner required.'); end if;
  select a into ans from jsonb_array_elements(v.snapshot#>'{response,answers}') a where a->>'requirementId'=req.id::text;
  if ans is null or (ans->>'requirementVersion')::timestamptz is distinct from req.updated_at or coalesce(ans->>'text','') !~ '\S' or (ans->>'text') ~* '(\[(human input required|complete|confirm|describe|check|not recorded|answer not supplied|response overview not supplied|insert|add)\M|\m(TODO|TBD)\M)' then blockers:=blockers||jsonb_build_array('Requirement '||req.id||': current completed answer required.'); end if;
 end loop;
 foreach k in array array['instructions','attachments','forms','signatures','certifications','amendments','pricing','filenames','formats','limits','source_review'] loop
  item:=v.snapshot->'checklist'->k;
  if coalesce(item->>'status','') not in ('confirmed','not_applicable') then blockers:=blockers||jsonb_build_array('Checklist '||k||': '||coalesce(item->>'status','unknown')); end if;
 end loop;
 foreach k in array array['pricing','compliance','final','submission'] loop
  select * into gate_record from public.response_approval_history where organization_id=org and release_id=release and approval_type=k order by sequence desc limit 1;
  if gate_record.decision='approved' and current_version and gate_record.checksum=v.checksum
    and exists(select 1 from public.organization_memberships m where m.organization_id=org and m.user_id=gate_record.approver and m.status='active' and (m.role in ('organization_admin','executive_approver') or (k='pricing' and m.role='estimator')))
    and (k in ('pricing','compliance') or (k='final' and gate_record.dependencies=ids) or (k='submission' and gate_record.dependencies=ids)) then
   approvals:=approvals||jsonb_build_object(k,true); ids:=ids||jsonb_build_object(k,gate_record.id);
  else approvals:=approvals||jsonb_build_object(k,false); end if;
 end loop;
 state:=case when not current_version then 'Needs review' when jsonb_array_length(blockers)>0 then 'Not ready' when coalesce((approvals->>'submission')::boolean,false) then 'Authorized for submission' when coalesce((approvals->>'pricing')::boolean,false) and coalesce((approvals->>'compliance')::boolean,false) then 'Ready for final approval' else 'Ready for internal review' end;
 select id into submitted from public.response_submission_history where organization_id=org and release_id=release order by sequence desc limit 1;
 if submitted is not null then state:='Submitted'; end if;
 return jsonb_build_object('state',state,'current',current_version,'blockers',blockers,'approvals',approvals,'approval_ids',ids,'submission_id',submitted,'checksum',v.checksum,
 'history_revision',jsonb_build_array((select max(sequence) from public.response_approval_history where organization_id=org and release_id=release),(select max(sequence) from public.response_submission_history where organization_id=org and release_id=release),(select max(sequence) from public.response_followup_history where organization_id=org and release_id=release)));
end $$;
create or replace function private.refresh_linked_evidence(org uuid,pursuit uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare row record; signature text; affected integer:=0; assignee uuid;
begin
  perform 1 from public.pursuits p join public.organizations o on o.id=p.organization_id
    where p.organization_id=org and p.id=pursuit and p.status not in ('closed','archived') and o.status<>'suspended' for update of p;
  if not found then return 0; end if;
  for row in select r.id,r.evidence_freshness_token,r.owner_user_id from public.pursuit_requirements r
    where r.organization_id=org and r.pursuit_id=pursuit and r.archived_at is null order by r.id for update loop
    select md5(jsonb_agg(jsonb_build_array(f.id,f.updated_at,f.expiration_date) order by f.id)::text) into signature
    from public.profile_facts f join (
      select distinct on (v.fact_id) v.fact_id,v.applicability from public.evidence_use_reviews v
      where v.organization_id=org and v.requirement_id=row.id order by v.fact_id,v.reviewed_at desc,v.sequence desc
    ) latest on latest.fact_id=f.id and latest.applicability<>'not_applicable'
    where f.organization_id=org and (f.expiration_date < (now() at time zone 'UTC')::date
      or private.evidence_checked_date(f.structured_fields,f.verified_at) < (now() at time zone 'UTC')::date-90);
    if signature is not null and signature is distinct from row.evidence_freshness_token then
      update public.pursuit_requirements set status='needs_review',evidence_freshness_token=signature
        where organization_id=org and id=row.id;
      -- Requirement owner first; otherwise a current bid lead/admin. Do not expose fact details in tasks.
      select m.user_id into assignee from public.organization_memberships m
        where m.organization_id=org and m.status='active'
        and (m.user_id=row.owner_user_id or m.role in ('organization_admin','capture_manager'))
        order by (m.user_id=row.owner_user_id) desc nulls last,(m.role='organization_admin') desc,m.created_at,m.id limit 1;
      insert into public.pursuit_tasks(organization_id,pursuit_id,requirement_id,title,status,priority,assigned_user_id,notes)
        values(org,pursuit,row.id,'Review expired or stale evidence for a linked requirement','todo','high',assignee,
          'A current evidence link needs a freshness review. Open the authorized evidence trail to see the source. Review the requirement and reaffirm affected sign-offs and decisions; previous decisions remain in history.');
      affected:=affected+1;
    elsif signature is null and row.evidence_freshness_token is not null then
      -- Reset the event marker only; renewal never auto-approves a requirement or closes a task.
      update public.pursuit_requirements set evidence_freshness_token=null where organization_id=org and id=row.id;
    end if;
  end loop;
  return affected;
end $$;
create or replace function private.amendment_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.opportunity_id<>old.opportunity_id then raise exception 'Amendment cannot move to another opportunity'; end if;
  new.created_by:=old.created_by; new.created_at:=old.created_at;
  if row(new.label,new.issued_on,new.source_url,new.summary,new.notice_text) is distinct from row(old.label,old.issued_on,old.source_url,old.summary,old.notice_text) then new.reviewed:=false; end if;
 else new.created_by:=auth.uid(); new.created_at:=clock_timestamp(); end if;
 new.updated_at:=clock_timestamp();
 if new.reviewed then new.reviewed_by:=auth.uid(); new.reviewed_at:=clock_timestamp(); else new.reviewed_by:=null;new.reviewed_at:=null;end if;
 update public.opportunities set updated_at=clock_timestamp() where organization_id=new.organization_id and id=new.opportunity_id;
 update public.pursuit_requirements r set status='needs_review',updated_at=clock_timestamp() where r.organization_id=new.organization_id and r.archived_at is null and exists(select 1 from public.pursuits p where p.organization_id=r.organization_id and p.id=r.pursuit_id and p.opportunity_id=new.opportunity_id);
 return new;
end $$;
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
 if r.archived_at is not null then raise exception 'Restore the archived requirement before reviewing'; end if;
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
create or replace function private.guard_evidence_use_review() returns trigger language plpgsql security definer set search_path='' as $$
declare f public.profile_facts; r public.pursuit_requirements; today date := (now() at time zone 'UTC')::date;
begin
  if auth.uid() is null or coalesce(private.member_role(new.organization_id)::text,'') not in ('organization_admin','executive_approver') then
    raise exception 'Human reviewer required' using errcode='42501';
  end if;
  -- Locks serialize a review with edits to either source.
  select * into f from public.profile_facts where organization_id=new.organization_id and id=new.fact_id for update;
  if not found then raise exception 'Evidence unavailable' using errcode='42501'; end if;
  select * into r from public.pursuit_requirements where organization_id=new.organization_id and id=new.requirement_id for update;
  if not found then raise exception 'Requirement unavailable' using errcode='42501'; end if;
  if r.archived_at is not null then raise exception 'Restore the archived requirement before linking evidence'; end if;
  if f.updated_at is distinct from new.fact_version or r.updated_at is distinct from new.requirement_version then
    raise exception 'Evidence or requirement changed' using errcode='P0001';
  end if;
  if new.proposal_use='approved' and (
    new.applicability<>'applicable' or f.verification_status not in ('verified','expiring') or
    f.verified_by is null or f.verified_at is null or nullif(btrim(f.value),'') is null or
    nullif(btrim(f.source_reference),'') is null or nullif(btrim(r.citation),'') is null or
    f.sensitivity='unknown' or f.expiration_date<today or f.effective_date>today
  ) then raise exception 'Current verified evidence and cited applicable requirement required'; end if;
  if not public.consume_admin_mutation() then raise exception 'Review rate limit reached'; end if;
  new.reviewed_by:=auth.uid(); new.reviewed_at:=clock_timestamp();
  return new;
end $$;
