-- Restrictive policy composes with existing tenant/classification RLS; no record data is changed.
-- Existing approved response text remains deliberately shared; raw financial Passport records are administrator-only.
create policy financial_passport_admin_only on public.profile_facts as restrictive for select to authenticated
using (fact_type <> 'financial' or private.member_role(organization_id) = 'organization_admin');

create or replace function public.acknowledge_evidence_reminder(org uuid,reminder uuid,expected_version timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.evidence_reminders; f public.profile_facts; actor_role public.organization_role;
begin
  actor_role:=private.member_role(org);
  if actor_role is null then raise exception 'Workspace access required' using errcode='42501'; end if;
  select * into r from public.evidence_reminders where organization_id=org and id=reminder for update;
  if not found or r.resolved_at is not null or r.updated_at is distinct from expected_version then raise exception 'Reminder changed; refresh and review' using errcode='40001'; end if;
  select * into f from public.profile_facts where organization_id=org and id=r.fact_id;
  if f.fact_type='financial' and actor_role<>'organization_admin' then raise exception 'Source access required' using errcode='42501'; end if;
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

create or replace function private.monitor_organization_evidence(org uuid) returns integer
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
      and (f.fact_type<>'financial' or m.role='organization_admin')
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
