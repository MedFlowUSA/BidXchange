-- A private scheduler owns processing; authenticated callers retain only organization-scoped access.
create function private.evidence_checked_date(fields jsonb, attested timestamptz) returns date
language plpgsql immutable set search_path='' as $$
begin
  if nullif(fields->>'last_checked','') is not null then
    begin return (fields->>'last_checked')::date; exception when others then return null; end;
  end if;
  return (attested at time zone 'UTC')::date;
end $$;
revoke all on function private.evidence_checked_date(jsonb,timestamptz) from public,anon,authenticated;

create function private.refresh_linked_evidence(org uuid,pursuit uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare row record; signature text; affected integer:=0; assignee uuid;
begin
  perform 1 from public.pursuits p join public.organizations o on o.id=p.organization_id
    where p.organization_id=org and p.id=pursuit and p.status not in ('closed','archived') and o.status<>'suspended' for update of p;
  if not found then return 0; end if;
  for row in select r.id,r.evidence_freshness_token,r.owner_user_id from public.pursuit_requirements r
    where r.organization_id=org and r.pursuit_id=pursuit order by r.id for update loop
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
revoke all on function private.refresh_linked_evidence(uuid,uuid) from public,anon,authenticated;

create or replace function public.refresh_pursuit_evidence_freshness(org uuid,pursuit uuid) returns integer
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or private.member_role(org) is null then raise exception 'Workspace access required' using errcode='42501'; end if;
  return private.refresh_linked_evidence(org,pursuit);
end $$;
revoke all on function public.refresh_pursuit_evidence_freshness(uuid,uuid) from public,anon;
grant execute on function public.refresh_pursuit_evidence_freshness(uuid,uuid) to authenticated;

create table public.evidence_reminders (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  fact_id uuid not null, kind text not null check(kind in ('expired','stale','30','60','90')),
  event_token text not null, assigned_user_id uuid, acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz, resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id) on delete cascade,
  foreign key(organization_id,assigned_user_id) references public.organization_memberships(organization_id,user_id),
  unique(organization_id,fact_id)
);
alter table public.evidence_reminders enable row level security;
revoke all on public.evidence_reminders from public,anon,authenticated;
grant select on public.evidence_reminders to authenticated;
create policy reminder_visible_source on public.evidence_reminders for select to authenticated using(
  private.member_role(organization_id) is not null and exists(select 1 from public.profile_facts f
    where f.organization_id=evidence_reminders.organization_id and f.id=evidence_reminders.fact_id)
);
create index evidence_reminder_open on public.evidence_reminders(organization_id,assigned_user_id,updated_at desc) where resolved_at is null;
create trigger reminder_identity before update on public.evidence_reminders for each row execute function private.guard_tenant();
create trigger reminder_audit after insert or update or delete on public.evidence_reminders for each row execute function private.audit_change();

-- The narrow definer RPC reproduces source-read policy and checks assignment; acknowledgement is not resolution.
create function public.acknowledge_evidence_reminder(org uuid,reminder uuid,expected_version timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.evidence_reminders; f public.profile_facts; actor_role public.organization_role;
begin
  actor_role:=private.member_role(org);
  if actor_role is null then raise exception 'Workspace access required' using errcode='42501'; end if;
  select * into r from public.evidence_reminders where organization_id=org and id=reminder for update;
  if not found or r.resolved_at is not null or r.updated_at is distinct from expected_version then raise exception 'Reminder changed; refresh and review' using errcode='40001'; end if;
  select * into f from public.profile_facts where organization_id=org and id=r.fact_id;
  if not (actor_role in ('organization_admin','executive_approver','estimator') or
    (f.sensitivity='workspace' and f.fact_type in ('identity','license','registration','naics','service_territory','capability','certification'))) then
    raise exception 'Source access required' using errcode='42501';
  end if;
  if actor_role not in ('organization_admin','executive_approver') and r.assigned_user_id is distinct from auth.uid() then
    raise exception 'Reminder owner or reviewer required' using errcode='42501';
  end if;
  if r.acknowledged_at is not null then return true; end if;
  update public.evidence_reminders set acknowledged_by=auth.uid(),acknowledged_at=clock_timestamp() where id=r.id and organization_id=org;
  return true;
end $$;
revoke all on function public.acknowledge_evidence_reminder(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.acknowledge_evidence_reminder(uuid,uuid,timestamptz) to authenticated;

create table private.evidence_monitor_state (
  organization_id uuid primary key references public.organizations(id), last_attempt_at timestamptz,
  last_success_at timestamptz, last_error_code text, changed_requirements integer not null default 0
);
revoke all on private.evidence_monitor_state from public,anon,authenticated;

create function private.monitor_organization_evidence(org uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare f record; p record; today date:=(now() at time zone 'UTC')::date; checked date;
  category text; signature text; assignee uuid; affected integer:=0;
begin
  perform 1 from public.organizations where id=org and status<>'suspended';
  if not found then return 0; end if;
  for f in select * from public.profile_facts where organization_id=org order by id loop
    checked:=private.evidence_checked_date(f.structured_fields,f.verified_at);
    category:=case when f.expiration_date<today then 'expired' when checked<today-90 then 'stale'
      when f.expiration_date<=today+30 then '30' when f.expiration_date<=today+60 then '60'
      when f.expiration_date<=today+90 then '90' else null end;
    if category is null then
      update public.evidence_reminders set resolved_at=clock_timestamp() where organization_id=org and fact_id=f.id and resolved_at is null;
      continue;
    end if;
    select m.user_id into assignee from public.organization_memberships m where m.organization_id=org and m.status='active'
      and (m.user_id=f.owner_user_id or m.role='organization_admin')
      and (m.role in ('organization_admin','executive_approver','estimator') or
        (f.sensitivity='workspace' and f.fact_type in ('identity','license','registration','naics','service_territory','capability','certification')))
      order by (m.user_id=f.owner_user_id) desc nulls last,m.created_at,m.id limit 1;
    signature:=md5(jsonb_build_array(category,f.updated_at,f.expiration_date,checked,assignee)::text);
    insert into public.evidence_reminders(organization_id,fact_id,kind,event_token,assigned_user_id)
      values(org,f.id,category,signature,assignee)
      on conflict(organization_id,fact_id) do update set kind=excluded.kind,event_token=excluded.event_token,
        assigned_user_id=excluded.assigned_user_id,acknowledged_at=null,acknowledged_by=null,resolved_at=null
      where evidence_reminders.event_token is distinct from excluded.event_token or evidence_reminders.resolved_at is not null;
  end loop;
  for p in select id from public.pursuits where organization_id=org and status not in ('closed','archived') order by id loop
    affected:=affected+private.refresh_linked_evidence(org,p.id);
  end loop;
  return affected;
end $$;
revoke all on function private.monitor_organization_evidence(uuid) from public,anon,authenticated;

create function private.run_evidence_monitor(batch_size integer default 25) returns integer
language plpgsql security definer set search_path='' as $$
declare row record; changed integer; completed integer:=0;
begin
  if batch_size not between 1 and 100 or batch_size is null then raise exception 'Invalid batch size'; end if;
  if not pg_try_advisory_xact_lock(20260922,28) then return 0; end if;
  for row in select o.id from public.organizations o left join private.evidence_monitor_state s on s.organization_id=o.id
    where o.status<>'suspended' and (s.last_success_at is null or (s.last_success_at at time zone 'UTC')::date < (now() at time zone 'UTC')::date)
      and (s.last_attempt_at is null or s.last_attempt_at<now()-interval '15 minutes')
    order by s.last_attempt_at nulls first,o.id limit batch_size loop
    insert into private.evidence_monitor_state(organization_id,last_attempt_at) values(row.id,clock_timestamp())
      on conflict(organization_id) do update set last_attempt_at=excluded.last_attempt_at;
    begin
      changed:=private.monitor_organization_evidence(row.id);
      update private.evidence_monitor_state set last_success_at=clock_timestamp(),last_error_code=null,changed_requirements=changed where organization_id=row.id;
      completed:=completed+1;
    exception when others then
      update private.evidence_monitor_state set last_error_code=sqlstate where organization_id=row.id;
    end;
  end loop;
  return completed;
end $$;
revoke all on function private.run_evidence_monitor(integer) from public,anon,authenticated;

create function public.evidence_monitor_status(org uuid)
returns table(last_attempt_at timestamptz,last_success_at timestamptz,failed boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if private.member_role(org) is null then raise exception 'Workspace access required' using errcode='42501'; end if;
  return query select s.last_attempt_at,s.last_success_at,s.last_error_code is not null from private.evidence_monitor_state s where s.organization_id=org;
end $$;
revoke all on function public.evidence_monitor_status(uuid) from public,anon;
grant execute on function public.evidence_monitor_status(uuid) to authenticated;
