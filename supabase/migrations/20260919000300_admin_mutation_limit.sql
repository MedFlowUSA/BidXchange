create table private.admin_mutation_limits(user_id uuid primary key references auth.users(id) on delete cascade, window_start timestamptz not null, attempts integer not null);
revoke all on private.admin_mutation_limits from public,anon,authenticated;
create function public.consume_admin_mutation() returns boolean language plpgsql security definer set search_path='' as $$
declare count_now integer;
begin
  if auth.uid() is null then return false; end if;
  insert into private.admin_mutation_limits(user_id,window_start,attempts) values(auth.uid(),now(),1)
  on conflict(user_id) do update set
    attempts=case when private.admin_mutation_limits.window_start<now()-interval '1 minute' then 1 else private.admin_mutation_limits.attempts+1 end,
    window_start=case when private.admin_mutation_limits.window_start<now()-interval '1 minute' then now() else private.admin_mutation_limits.window_start end
  returning attempts into count_now;
  return count_now<=20;
end $$;
revoke all on function public.consume_admin_mutation() from public,anon;
grant execute on function public.consume_admin_mutation() to authenticated;
