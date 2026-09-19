-- Forward-only: no users, organizations, document access or model activation.
alter table public.profile_facts add column sensitivity text not null default 'unknown'
  check (sensitivity in ('unknown','workspace','restricted'));
-- Classification covers the entire fact, including evidence and notes. Unknown fails closed.
drop policy tenant_read on public.profile_facts;
create policy tenant_read on public.profile_facts for select to authenticated using (
  private.member_role(organization_id) in ('organization_admin','executive_approver','estimator')
  or (sensitivity='workspace' and fact_type in ('identity','license','registration','naics','service_territory','capability','certification')
      and private.member_role(organization_id) is not null)
);

create table public.ai_organization_settings (
  organization_id uuid primary key references public.organizations(id),
  enabled boolean not null default false,
  daily_org_limit integer not null default 100 check(daily_org_limit between 1 and 1000),
  daily_user_limit integer not null default 20 check(daily_user_limit between 1 and 100),
  updated_at timestamptz not null default now()
);
alter table public.ai_organization_settings enable row level security;
revoke all on public.ai_organization_settings from public,anon,authenticated;
grant select on public.ai_organization_settings to authenticated;
create policy member_read on public.ai_organization_settings for select to authenticated
  using(private.member_role(organization_id) is not null);
-- Activation and limits are operator-controlled; no browser write grant.
create table public.ai_usage_events (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  prompt_digest text not null check(prompt_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  feedback text check(feedback in ('helpful','unhelpful')),
  unique(organization_id,id)
);
create index ai_usage_org_day on public.ai_usage_events(organization_id,created_at);
create index ai_usage_user_day on public.ai_usage_events(user_id,created_at);
alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from public,anon,authenticated;
-- Digest never exposed. Counts are charged at reservation, including cancellations/failures.
grant select(id,organization_id,user_id,created_at,feedback) on public.ai_usage_events to authenticated;
create policy owner_or_admin on public.ai_usage_events for select to authenticated using (
  private.member_role(organization_id) is not null and
  (user_id=auth.uid() or private.member_role(organization_id)='organization_admin')
);
create function public.reserve_ai_request(org uuid, request_id uuid, digest text, org_limit integer, user_limit integer)
returns text language plpgsql security definer set search_path='' as $$
declare settings public.ai_organization_settings; today timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
  if auth.uid() is null or private.member_role(org) is null then return 'forbidden'; end if;
  if request_id is null or digest is null or digest !~ '^[a-f0-9]{64}$' or org_limit is null or user_limit is null or org_limit<1 or user_limit<1 then return 'invalid_request'; end if;
  -- Serialize both cross-organization user consumption and organization consumption.
  perform pg_advisory_xact_lock(hashtextextended('ai-user:'||auth.uid()::text,0));
  perform pg_advisory_xact_lock(hashtextextended('ai-org:'||org::text,0));
  select * into settings from public.ai_organization_settings where organization_id=org;
  if not found or not settings.enabled then return 'unavailable'; end if;
  if exists(select 1 from public.ai_usage_events where id=request_id) then return 'duplicate'; end if;
  if exists(select 1 from public.ai_usage_events where organization_id=org and user_id=auth.uid() and prompt_digest=digest and created_at>now()-interval '2 minutes') then return 'duplicate'; end if;
  if (select count(*) from public.ai_usage_events where user_id=auth.uid() and created_at>now()-interval '1 minute')>=3
    or (select count(*) from public.ai_usage_events where organization_id=org and created_at>now()-interval '1 minute')>=10
    or (select count(*) from public.ai_usage_events where user_id=auth.uid() and created_at>=today)>=least(user_limit,settings.daily_user_limit)
    or (select count(*) from public.ai_usage_events where organization_id=org and created_at>=today)>=least(org_limit,settings.daily_org_limit)
  then return 'rate_limited'; end if;
  insert into public.ai_usage_events(id,organization_id,user_id,prompt_digest) values(request_id,org,auth.uid(),digest);
  insert into public.audit_events(organization_id,actor_user_id,entity_table,entity_id,action)
    values(org,auth.uid(),'ai_usage_events',request_id,'AI_REQUEST_RESERVED');
  return 'reserved';
end $$;
revoke all on function public.reserve_ai_request(uuid,uuid,text,integer,integer) from public,anon;
grant execute on function public.reserve_ai_request(uuid,uuid,text,integer,integer) to authenticated;

create function public.ai_feedback(org uuid, request_id uuid, rating text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if private.member_role(org) is null or rating not in ('helpful','unhelpful') then return false; end if;
  update public.ai_usage_events set feedback=rating where id=request_id and organization_id=org and user_id=auth.uid() and feedback is null;
  return found;
end $$;
revoke all on function public.ai_feedback(uuid,uuid,text) from public,anon;
grant execute on function public.ai_feedback(uuid,uuid,text) to authenticated;
