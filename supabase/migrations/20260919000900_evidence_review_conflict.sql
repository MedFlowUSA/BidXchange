-- Stale business versions are not retryable database serialization failures.
create or replace function private.guard_evidence_use_review() returns trigger language plpgsql security definer set search_path='' as $$
declare f public.profile_facts; r public.pursuit_requirements; today date := (now() at time zone 'UTC')::date;
begin
  if auth.uid() is null or coalesce(private.member_role(new.organization_id)::text,'') not in ('organization_admin','executive_approver') then
    raise exception 'Human reviewer required' using errcode='42501';
  end if;
  -- Locks serialize a review with edits to either source.
  select * into f from public.profile_facts where organization_id=new.organization_id and id=new.fact_id for update;
  if not found then raise exception 'Evidence unavailable' using errcode='42501'; end if;
  select * into r from public.pursuit_requirements where organization_id=new.organization_id and id=new.requirement_id for update;
  if not found then raise exception 'Requirement unavailable' using errcode='42501'; end if;
  if f.updated_at is distinct from new.fact_version or r.updated_at is distinct from new.requirement_version then
    raise exception 'Evidence or requirement changed' using errcode='P0001';
  end if;
  if new.proposal_use='approved' and (
    new.applicability<>'applicable' or f.verification_status not in ('verified','expiring') or
    f.verified_by is null or f.verified_at is null or nullif(btrim(f.value),'') is null or
    nullif(btrim(f.source_reference),'') is null or nullif(btrim(r.citation),'') is null or
    f.sensitivity='unknown' or f.expiration_date<today or f.effective_date>today
  ) then raise exception 'Current verified evidence and cited applicable requirement required'; end if;
  if not public.consume_admin_mutation() then raise exception 'Review rate limit reached'; end if;
  new.reviewed_by:=auth.uid(); new.reviewed_at:=clock_timestamp();
  return new;
end $$;
