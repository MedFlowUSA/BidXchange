-- Preserve release approval checks and recognize human-input placeholders and explicit not-applicable findings.
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
 for req in select r.*,h.disposition,h.review_current from public.pursuit_requirements r left join public.current_requirement_resolutions h on h.organization_id=r.organization_id and h.requirement_id=r.id where r.organization_id=org and r.pursuit_id=v.pursuit_id loop
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
