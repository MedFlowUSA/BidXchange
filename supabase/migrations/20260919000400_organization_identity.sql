create function private.guard_organization() returns trigger language plpgsql set search_path='' as $$
begin
  if new.id<>old.id then raise exception 'Organization identity is immutable'; end if;
  if not exists(select 1 from pg_timezone_names where name=new.default_timezone) then raise exception 'Invalid timezone'; end if;
  new.updated_at:=now(); return new;
end $$;
create trigger guard_organization_update before update on public.organizations for each row execute function private.guard_organization();
