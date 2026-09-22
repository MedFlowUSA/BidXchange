-- now() is transaction-stable: distinct edits must still invalidate human reviews.
create or replace function private.guard_tenant() returns trigger language plpgsql set search_path='' as $$
begin
 if new.organization_id<>old.organization_id or new.id<>old.id then
   raise exception 'Tenant and record identity are immutable' using errcode='42501';
 end if;
 new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
 return new;
end $$;
