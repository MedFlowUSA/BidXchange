-- NOT APPLIED. Diagnostic approval required. Staging project only.
-- Separate operational objects, not a production migration or tenant AI setting.
create table private.provider_diagnostic_runs (
  id uuid primary key,
  operator_user_id uuid not null references auth.users(id),
  enabled boolean not null default false,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  check (not enabled or expires_at is not null)
);
alter table private.provider_diagnostic_runs enable row level security;
revoke all on private.provider_diagnostic_runs from public,anon,authenticated;
create function public.claim_provider_diagnostic(run uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then return false; end if;
  update private.provider_diagnostic_runs set claimed_at=clock_timestamp(),enabled=false
    where id=run and operator_user_id=auth.uid() and enabled
      and claimed_at is null and expires_at>clock_timestamp();
  return found;
end $$;
revoke all on function public.claim_provider_diagnostic(uuid) from public,anon;
grant execute on function public.claim_provider_diagnostic(uuid) to authenticated;
-- Insert one disabled run only after diagnostic-deployment approval.
-- Arm with a <=15-minute expiry only after the separate paid-request approval.
-- Never reset claimed_at. Preserve the consumed claim until the deployment is deleted.
