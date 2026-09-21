-- Public demo has separate bounded usage, never organization membership or data access.
create table public.demo_ai_settings(id boolean primary key default true check(id),enabled boolean not null default false);
insert into public.demo_ai_settings(id) values(true);
create table public.demo_ai_usage(
 request_id uuid primary key, visitor_hash text not null check(visitor_hash ~ '^[a-f0-9]{64}$'),
 network_hash text not null check(network_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now()
);
create index demo_ai_usage_time on public.demo_ai_usage(created_at);
alter table public.demo_ai_settings enable row level security;
alter table public.demo_ai_usage enable row level security;
revoke all on public.demo_ai_settings,public.demo_ai_usage from public,anon,authenticated,service_role;
grant select on public.demo_ai_settings to service_role;
create function public.reserve_demo_ai(request_id uuid,visitor_hash text,network_hash text) returns text
language plpgsql security definer set search_path='' as $$
declare day_start timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if request_id is null or visitor_hash is null or network_hash is null or visitor_hash !~ '^[a-f0-9]{64}$' or network_hash !~ '^[a-f0-9]{64}$' then return 'invalid'; end if;
 perform pg_advisory_xact_lock(1396788553);
 if not exists(select 1 from public.demo_ai_settings where id and enabled) then return 'disabled'; end if;
 delete from public.demo_ai_usage where created_at<now()-interval '14 days';
 if exists(select 1 from public.demo_ai_usage u where u.request_id=reserve_demo_ai.request_id) then return 'duplicate'; end if;
 if (select count(*) from public.demo_ai_usage where created_at>=day_start)>=100 then return 'daily_limit'; end if;
 if (select count(*) from public.demo_ai_usage u where created_at>=day_start and u.visitor_hash=reserve_demo_ai.visitor_hash)>=5 then return 'visitor_limit'; end if;
 if (select count(*) from public.demo_ai_usage u where created_at>=day_start and u.network_hash=reserve_demo_ai.network_hash)>=10 then return 'network_limit'; end if;
 if exists(select 1 from public.demo_ai_usage u where created_at>now()-interval '1 minute' and (u.visitor_hash=reserve_demo_ai.visitor_hash or u.network_hash=reserve_demo_ai.network_hash)) then return 'wait'; end if;
 insert into public.demo_ai_usage(request_id,visitor_hash,network_hash) values(request_id,visitor_hash,network_hash);
 return 'reserved';
end $$;
revoke all on function public.reserve_demo_ai(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_demo_ai(uuid,text,text) to service_role;
