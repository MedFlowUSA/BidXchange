-- Human-controlled release records. No portal automation or storage permissions.
create table public.response_release_versions (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
 organization_id uuid not null references public.organizations(id), pursuit_id uuid not null,
 package_id uuid not null references public.proposal_sections(id), package_version timestamptz not null,
 context_token text not null, checksum text not null, snapshot jsonb not null,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,id), unique(package_id,package_version,context_token,checksum),
 foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id)
);
create table public.response_approval_history (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
 organization_id uuid not null, release_id uuid not null,
 approval_type text not null check(approval_type in ('pricing','compliance','final','submission')),
 decision text not null check(decision in ('approved','rejected','revoked')),
 approver uuid not null references auth.users(id), role_at_decision text not null,
 decided_at timestamptz not null default clock_timestamp(),
 rationale text not null check(length(btrim(rationale)) between 1 and 2000),
 conditions text not null check(length(conditions)<=2000), checksum text not null,
 dependencies jsonb not null default '{}',
 foreign key(organization_id,release_id) references public.response_release_versions(organization_id,id)
);
create table public.response_submission_history (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
 organization_id uuid not null, release_id uuid not null,
 previous_id uuid references public.response_submission_history(id),
 kind text not null check(kind in ('initial','correction','resubmission')),
 submitted_by uuid not null references auth.users(id), recorded_by uuid not null references auth.users(id),
 submitted_at timestamptz not null, recorded_at timestamptz not null default clock_timestamp(),
 details jsonb not null, authorization_id uuid not null references public.response_approval_history(id),
 checksum text not null,
 foreign key(organization_id,release_id) references public.response_release_versions(organization_id,id)
);
create table public.response_followup_history (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
 organization_id uuid not null, release_id uuid not null,
 event_type text not null check(event_type in ('agency_question','clarification','interview','best_final_offer','award','loss','cancelled','debrief_requested','debrief_received','lessons_learned')),
 note text not null check(length(btrim(note)) between 1 and 2000), due_at timestamptz,
 recorded_by uuid not null references auth.users(id), recorded_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,release_id) references public.response_release_versions(organization_id,id)
);
-- Defense in depth: no update/delete, even via a future accidental grant.
create function private.immutable_response_history() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Response history is immutable'; end $$;
revoke all on function private.immutable_response_history() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['response_release_versions','response_approval_history','response_submission_history','response_followup_history'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('revoke all on sequence public.%I from public,anon,authenticated',t||'_sequence_seq');
  execute format('create policy member_read on public.%I for select to authenticated using(private.member_role(organization_id) is not null)',t);
  execute format('create trigger immutable_history before update or delete on public.%I for each row execute function private.immutable_response_history()',t);
  execute format('create trigger audit_history after insert on public.%I for each row execute function private.audit_change()',t);
 end loop;
end $$;
create index release_parent on public.response_release_versions(organization_id,pursuit_id,sequence desc);
create index approval_release on public.response_approval_history(organization_id,release_id,sequence desc);
create index submission_release on public.response_submission_history(organization_id,release_id,sequence desc);
create index followup_release on public.response_followup_history(organization_id,release_id,sequence desc);

create function public.response_release_context(org uuid,pursuit uuid) returns text
language plpgsql security definer set search_path='' as $$
declare result text; source_context jsonb; begin
 if auth.uid() is null or private.member_role(org) is null then raise exception 'Workspace access required' using errcode='42501'; end if;
 if to_regclass('public.source_inbox') is not null and to_regclass('public.source_records') is not null then
  execute 'select jsonb_agg(jsonb_build_array(i.id,i.updated_at,i.change_pending,s.current_version_id) order by i.id) from public.source_inbox i join public.source_records s on s.id=i.record_id join public.pursuits pu on pu.organization_id=i.organization_id and pu.opportunity_id=i.opportunity_id where pu.organization_id=$1 and pu.id=$2' into source_context using org,pursuit;
 end if;
 select encode(sha256(convert_to(jsonb_build_array(
  public.pursuit_decision_context(org,pursuit),o.updated_at,
  (select jsonb_build_array(op.title,op.buyer,op.solicitation_number,op.source_url,op.source_note,op.summary,op.official_deadline,op.deadline_timezone) from public.opportunities op join public.pursuits pu on pu.organization_id=op.organization_id and pu.opportunity_id=op.id where pu.organization_id=org and pu.id=pursuit),
  source_context,
  (select jsonb_agg(jsonb_build_array(h.id,h.review_current) order by h.requirement_id) from public.current_requirement_resolutions h where h.organization_id=org and h.pursuit_id=pursuit),
  (select jsonb_agg(jsonb_build_array(m.user_id,m.role,m.status) order by m.user_id) from public.organization_memberships m where m.organization_id=org),
  (select h.id from public.pursuit_decision_history h where h.organization_id=org and h.pursuit_id=pursuit order by h.decided_at desc,h.id desc limit 1)
 )::text,'UTF8')),'hex') into result from public.organizations o where o.id=org;
 return result;
end $$;

create function public.freeze_response_release(org uuid,pursuit uuid,package uuid,expected_version timestamptz,expected_context text,checklist jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.proposal_sections; context text; snap jsonb; content jsonb; result uuid; item jsonb; k text;
begin
 if auth.uid() is null or coalesce(private.member_role(org)::text,'') not in ('organization_admin','capture_manager') then raise exception 'Capture access required' using errcode='42501'; end if;
 select * into p from public.proposal_sections where organization_id=org and pursuit_id=pursuit and id=package for update;
 if not found or p.status<>'draft' or p.updated_at is distinct from expected_version then raise exception 'Saved response changed or unavailable'; end if;
 content:=p.content::jsonb;
 if content->>'schema' is distinct from '1' or jsonb_typeof(content->'answers') is distinct from 'array' or length(p.content)>100000 then raise exception 'Unsupported response'; end if;
 if jsonb_array_length(content->'answers')>100 or (select count(*) from public.pursuit_requirements where organization_id=org and pursuit_id=pursuit)>100
 or exists(select 1 from jsonb_array_elements(content->'answers') a group by a->>'requirementId' having count(*)>1) then raise exception 'Bounded unique response answers required'; end if;
 for item in select value from jsonb_array_elements(content->'answers') loop
  if jsonb_typeof(item) is distinct from 'object' or length(coalesce(item->>'text',''))>4000 or nullif(item->>'requirementVersion','') is null
    or not exists(select 1 from public.pursuit_requirements where organization_id=org and pursuit_id=pursuit and id=(item->>'requirementId')::uuid) then raise exception 'Invalid response answer'; end if;
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
 'requirements',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'text',r.requirement,'citation',r.citation,'owner',r.owner_user_id,'version',r.updated_at,'finding',h.disposition,'review_current',h.review_current) order by r.id),'[]') from public.pursuit_requirements r left join public.current_requirement_resolutions h on h.organization_id=r.organization_id and h.requirement_id=r.id where r.organization_id=org and r.pursuit_id=pursuit),
 'bid_decision',(select jsonb_build_object('id',h.id,'decision',h.decision,'actor',h.decided_by,'at',h.decided_at,'conditions',h.conditions,'reason',h.reason) from public.pursuit_decision_history h where h.organization_id=org and h.pursuit_id=pursuit order by h.decided_at desc,h.id desc limit 1));
 if not public.consume_admin_mutation() then raise exception 'Please wait before trying again'; end if;
 insert into public.response_release_versions(organization_id,pursuit_id,package_id,package_version,context_token,checksum,snapshot,created_by)
 values(org,pursuit,package,p.updated_at,context,encode(sha256(convert_to(snap::text,'UTF8')),'hex'),snap,auth.uid())
 on conflict(package_id,package_version,context_token,checksum) do nothing returning id into result;
 if result is null then select id into result from public.response_release_versions where package_id=package and package_version=p.updated_at and context_token=context and checksum=encode(sha256(convert_to(snap::text,'UTF8')),'hex'); end if;
 return result;
end $$;

create function public.response_release_status(org uuid,release uuid) returns jsonb
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
 if coalesce(v.snapshot#>>'{response,summary}','') !~ '\S' or (v.snapshot#>>'{response,summary}') ~* '(\[(complete|confirm|describe|check|insert|add)\M|\m(TODO|TBD)\M)' then blockers:=blockers||jsonb_build_array('Complete the response overview and remove placeholders.'); end if;
 for req in select r.*,h.disposition,h.review_current from public.pursuit_requirements r left join public.current_requirement_resolutions h on h.organization_id=r.organization_id and h.requirement_id=r.id where r.organization_id=org and r.pursuit_id=v.pursuit_id loop
  if nullif(btrim(req.citation),'') is null or req.owner_user_id is null or not exists(select 1 from public.organization_memberships m where m.organization_id=org and m.user_id=req.owner_user_id and m.status='active') or req.review_current is distinct from true or coalesce(req.disposition,'') not in ('supported','waived') then blockers:=blockers||jsonb_build_array('Requirement '||req.id||': current supported/waived finding, citation and active owner required.'); end if;
  select a into ans from jsonb_array_elements(v.snapshot#>'{response,answers}') a where a->>'requirementId'=req.id::text;
  if ans is null or (ans->>'requirementVersion')::timestamptz is distinct from req.updated_at or coalesce(ans->>'text','') !~ '\S' or (ans->>'text') ~* '(\[(complete|confirm|describe|check|insert|add)\M|\m(TODO|TBD)\M)' then blockers:=blockers||jsonb_build_array('Requirement '||req.id||': current completed answer required.'); end if;
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

create function public.record_response_approval(org uuid,release uuid,expected_checksum text,gate text,outcome text,rationale text,conditions text,expected_previous uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.response_release_versions; role_name text; previous uuid; s jsonb; deps jsonb:='{}'; result uuid;
begin
 role_name:=private.member_role(org)::text;
 if auth.uid() is null or (coalesce(role_name,'') not in ('organization_admin','executive_approver') and not (coalesce(role_name,'')='estimator' and gate='pricing')) then raise exception 'Authorized approver required' using errcode='42501'; end if;
 select * into v from public.response_release_versions where organization_id=org and id=release for update;
 if not found or expected_checksum is distinct from v.checksum then raise exception 'Response version unavailable'; end if;
 if gate is null or gate not in ('pricing','compliance','final','submission') or outcome is null or outcome not in ('approved','rejected','revoked') or length(btrim(coalesce(rationale,''))) not between 1 and 2000 or conditions is null or length(conditions)>2000 then raise exception 'Decision and rationale required'; end if;
 select id into previous from public.response_approval_history where organization_id=org and release_id=release and approval_type=gate order by sequence desc limit 1;
 if previous is distinct from expected_previous then raise exception 'Approval history changed; reload'; end if;
 s:=public.response_release_status(org,release);
 if outcome='approved' then
  if not (s->>'current')::boolean or jsonb_array_length(s->'blockers')>0 then raise exception 'Resolve response readiness blockers first'; end if;
  if gate in ('final','submission') then
   if coalesce((s#>>'{approvals,pricing}')::boolean,false) is not true or coalesce((s#>>'{approvals,compliance}')::boolean,false) is not true then raise exception 'Pricing and compliance approval required'; end if;
   deps:=jsonb_build_object('pricing',s#>'{approval_ids,pricing}','compliance',s#>'{approval_ids,compliance}');
  end if;
  if gate='submission' then
   if coalesce((s#>>'{approvals,final}')::boolean,false) is not true then raise exception 'Final response approval required'; end if;
   deps:=deps||jsonb_build_object('final',s#>'{approval_ids,final}');
  end if;
 end if;
 if not public.consume_admin_mutation() then raise exception 'Please wait before trying again'; end if;
 insert into public.response_approval_history(organization_id,release_id,approval_type,decision,approver,role_at_decision,rationale,conditions,checksum,dependencies)
 values(org,release,gate,outcome,auth.uid(),role_name,btrim(rationale),btrim(conditions),v.checksum,deps) returning id into result;
 return result;
end $$;

create function public.record_response_submission(org uuid,release uuid,expected_checksum text,details jsonb,previous uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.response_release_versions; s jsonb; result uuid; latest uuid; prior public.response_submission_history;
begin
 if auth.uid() is null or coalesce(private.member_role(org)::text,'') not in ('organization_admin','executive_approver','capture_manager') then raise exception 'Authorized submitter required' using errcode='42501'; end if;
 select * into v from public.response_release_versions where organization_id=org and id=release for update;
 if not found or expected_checksum is distinct from v.checksum or confirmed is distinct from true then raise exception 'Confirm the exact submitted version'; end if;
 if (v.snapshot#>>'{checklist,submitter}')::uuid is distinct from auth.uid() then raise exception 'Only the named authorized submitter may record submission'; end if;
 -- Serialize initial/correction/resubmission ordering across all versions of a pursuit.
 perform 1 from public.pursuits where organization_id=org and id=v.pursuit_id for update;
 if details is null or jsonb_typeof(details)<>'object' or octet_length(details::text)>12000 or details->>'kind' not in ('initial','correction','resubmission')
 or length(btrim(coalesce(details->>'method',''))) not between 1 and 200 or length(btrim(coalesce(details->>'portal',''))) not between 1 and 2000
 or length(btrim(coalesce(details->>'notes',''))) not between 1 and 2000
 or length(coalesce(details->>'confirmation',''))>500 or length(coalesce(details->>'receipt',''))>2000
 or coalesce(details->>'submitted_at','')='' or (details->>'submitted_at')::timestamptz>clock_timestamp()
 or (details->>'submitted_at')::timestamptz<v.created_at then raise exception 'Bounded submission details and valid time required'; end if;
 if exists(select 1 from jsonb_object_keys(details) key where key not in ('kind','method','portal','submitted_at','confirmation','receipt','receipt_limitation','notes','followup_at')) or length(coalesce(details->>'receipt_limitation',''))>2000 then raise exception 'Unsupported submission fields'; end if;
 if nullif(btrim(details->>'receipt'),'') is null and length(btrim(coalesce(details->>'receipt_limitation','')))<1 then raise exception 'Provide a receipt reference or explicitly record why it is unavailable'; end if;
 if nullif(details->>'followup_at','') is not null then perform (details->>'followup_at')::timestamptz; end if;
 select sh.id into latest from public.response_submission_history sh join public.response_release_versions rv on rv.organization_id=sh.organization_id and rv.id=sh.release_id where rv.organization_id=org and rv.pursuit_id=v.pursuit_id order by sh.sequence desc limit 1;
 if latest is distinct from previous or (latest is null) is distinct from (details->>'kind'='initial') then raise exception 'Submission history changed or correction type invalid'; end if;
 s:=public.response_release_status(org,release);
 -- Administrative corrections may preserve a historical authorized submission.
 if details->>'kind'='correction' then
  select * into prior from public.response_submission_history where organization_id=org and id=previous and release_id=release;
  if not found then raise exception 'Corrections must reference the same submitted version'; end if;
  if (details->>'submitted_at')::timestamptz < (select decided_at from public.response_approval_history where id=prior.authorization_id) then raise exception 'Submission must follow authorization'; end if;
 else
  if coalesce((s#>>'{approvals,submission}')::boolean,false) is not true or not (s->>'current')::boolean or jsonb_array_length(s->'blockers')>0 then raise exception 'Current submission authorization required'; end if;
  if (details->>'submitted_at')::timestamptz < (select decided_at from public.response_approval_history where id=(s#>>'{approval_ids,submission}')::uuid) then raise exception 'Submission must follow authorization'; end if;
 end if;
 if not public.consume_admin_mutation() then raise exception 'Please wait before trying again'; end if;
 insert into public.response_submission_history(organization_id,release_id,previous_id,kind,submitted_by,recorded_by,submitted_at,details,authorization_id,checksum)
 values(org,release,previous,details->>'kind',auth.uid(),auth.uid(),(details->>'submitted_at')::timestamptz,details,coalesce(prior.authorization_id,(s#>>'{approval_ids,submission}')::uuid),v.checksum) returning id into result;
 return result;
end $$;

create function public.record_response_followup(org uuid,release uuid,event_type text,note text,due_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; begin
 if auth.uid() is null or coalesce(private.member_role(org)::text,'') not in ('organization_admin','executive_approver','capture_manager') then raise exception 'Capture or executive access required' using errcode='42501'; end if;
 if not exists(select 1 from public.response_submission_history where organization_id=org and release_id=release) then raise exception 'Recorded submission required'; end if;
 if not public.consume_admin_mutation() then raise exception 'Please wait before trying again'; end if;
 insert into public.response_followup_history(organization_id,release_id,event_type,note,due_at,recorded_by) values(org,release,event_type,note,due_at,auth.uid()) returning id into result; return result;
end $$;
revoke all on function public.response_release_context(uuid,uuid),public.freeze_response_release(uuid,uuid,uuid,timestamptz,text,jsonb),public.response_release_status(uuid,uuid),public.record_response_approval(uuid,uuid,text,text,text,text,text,uuid),public.record_response_submission(uuid,uuid,text,jsonb,uuid,boolean),public.record_response_followup(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.response_release_context(uuid,uuid),public.freeze_response_release(uuid,uuid,uuid,timestamptz,text,jsonb),public.response_release_status(uuid,uuid),public.record_response_approval(uuid,uuid,text,text,text,text,text,uuid),public.record_response_submission(uuid,uuid,text,jsonb,uuid,boolean),public.record_response_followup(uuid,uuid,text,text,timestamptz) to authenticated;
