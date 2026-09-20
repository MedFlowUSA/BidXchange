-- Public prospect intake is isolated from tenant data. No operator is auto-enrolled.
create table private.demo_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
revoke all on private.demo_operators from public, anon, authenticated;

create function public.is_demo_operator() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.demo_operators where user_id=auth.uid())
$$;
revoke all on function public.is_demo_operator() from public, anon;
grant execute on function public.is_demo_operator() to authenticated;

create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check(length(btrim(full_name)) between 1 and 120),
  email text not null check(length(email) between 3 and 254 and email !~ '[[:space:]]' and email like '%@%.%'),
  company text not null check(length(btrim(company)) between 1 and 200),
  message text not null default '' check(length(message)<=1500),
  owner_name text not null default 'Manuel Rodriguez' check(owner_name='Manuel Rodriguez'),
  owner_email text not null default 'mrodriguez@oaisinc.com' check(owner_email='mrodriguez@oaisinc.com'),
  consent_version text not null default 'demo-contact-v1' check(consent_version='demo-contact-v1'),
  status text not null default 'new' check(status in ('new','contacted','qualified','closed')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index demo_requests_queue on public.demo_requests(status,created_at desc,id);
alter table public.demo_requests enable row level security;
revoke all on public.demo_requests from public,anon,authenticated;
grant select on public.demo_requests to authenticated;
create policy demo_operator_read on public.demo_requests for select to authenticated
  using(public.is_demo_operator());

create table private.demo_intake_limits (
  bucket text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
create table private.demo_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  actor_user_id uuid,
  action text not null,
  created_at timestamptz not null default now()
);
revoke all on private.demo_intake_limits,private.demo_request_events from public,anon,authenticated;

create function public.submit_demo_request(
  p_name text,p_email text,p_company text,p_message text,p_ip_hash text,p_email_hash text
) returns boolean language plpgsql security definer set search_path='' as $$
declare item record; count_now integer; accepted boolean := true; request_id uuid;
begin
  if p_name is null or length(btrim(p_name)) not between 1 and 120
    or p_email is null or length(p_email) not between 3 and 254 or p_email ~ '[[:space:]]' or p_email not like '%@%.%'
    or p_company is null or length(btrim(p_company)) not between 1 and 200
    or p_message is null or length(p_message)>1500
    or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
    or p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  -- Fixed lock order serializes each day's quotas across concurrent callers.
  -- Global cap also bounds storage even when attackers rotate IPs and email addresses.
  for item in select * from (values ('global',100),('ip:'||p_ip_hash,5),('email:'||p_email_hash,3)) q(bucket,maximum)
  loop
    insert into private.demo_intake_limits(bucket,window_start,attempts) values(item.bucket,now(),1)
    on conflict(bucket) do update set
      attempts=case when private.demo_intake_limits.window_start < now()-interval '24 hours' then 1 else least(private.demo_intake_limits.attempts+1,1000000) end,
      window_start=case when private.demo_intake_limits.window_start < now()-interval '24 hours' then now() else private.demo_intake_limits.window_start end
    returning attempts into count_now;
    if count_now > item.maximum then accepted := false; end if;
    -- Stop before allocating new per-IP/email buckets when the global quota is exhausted.
    if item.bucket='global' and not accepted then return false; end if;
  end loop;
  delete from private.demo_intake_limits where window_start < now()-interval '48 hours';
  if not accepted then return false; end if;
  insert into public.demo_requests(full_name,email,company,message)
    values(btrim(p_name),lower(p_email),btrim(p_company),btrim(p_message)) returning id into request_id;
  insert into private.demo_request_events(request_id,action) values(request_id,'created');
  return true;
end $$;
revoke all on function public.submit_demo_request(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_demo_request(text,text,text,text,text,text) to service_role;

create function public.review_demo_request(p_id uuid,p_version integer,p_status text)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed_id uuid;
begin
  if not public.is_demo_operator() then return false; end if;
  if p_status is null or p_status not in ('new','contacted','qualified','closed') then return false; end if;
  if not public.consume_admin_mutation() then return false; end if;
  update public.demo_requests set status=p_status,version=version+1,updated_at=now()
    where id=p_id and version=p_version returning id into changed_id;
  if changed_id is null then return false; end if;
  insert into private.demo_request_events(request_id,actor_user_id,action)
    values(p_id,auth.uid(),'status:'||p_status);
  return true;
end $$;
revoke all on function public.review_demo_request(uuid,integer,text) from public,anon;
grant execute on function public.review_demo_request(uuid,integer,text) to authenticated;

-- Explicit operator erasure, with non-content audit history retained.
create function public.erase_demo_request(p_id uuid,p_version integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare removed_id uuid;
begin
  if not public.is_demo_operator() then return false; end if;
  if not public.consume_admin_mutation() then return false; end if;
  delete from public.demo_requests where id=p_id and version=p_version returning id into removed_id;
  if removed_id is null then return false; end if;
  insert into private.demo_request_events(request_id,actor_user_id,action) values(p_id,auth.uid(),'erased');
  return true;
end $$;
revoke all on function public.erase_demo_request(uuid,integer) from public,anon;
grant execute on function public.erase_demo_request(uuid,integer) to authenticated;
