-- Human review of a specific evidence version for a specific pursuit requirement.
create table public.evidence_use_reviews (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  organization_id uuid not null references public.organizations(id),
  requirement_id uuid not null,
  fact_id uuid not null,
  fact_version timestamptz not null,
  requirement_version timestamptz not null,
  applicability text not null check(applicability in ('unknown','applicable','not_applicable')),
  proposal_use text not null check(proposal_use in ('not_approved','approved')),
  reason text not null check(length(btrim(reason)) between 1 and 2000),
  reviewed_by uuid not null references auth.users(id),
  reviewed_at timestamptz not null default now(),
  foreign key(organization_id,requirement_id) references public.pursuit_requirements(organization_id,id),
  foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create index evidence_use_pair on public.evidence_use_reviews(organization_id,requirement_id,fact_id,reviewed_at desc,sequence desc);
alter table public.evidence_use_reviews enable row level security;
revoke all on public.evidence_use_reviews from public,anon,authenticated;
grant select on public.evidence_use_reviews to authenticated;
grant insert(organization_id,requirement_id,fact_id,fact_version,requirement_version,applicability,proposal_use,reason) on public.evidence_use_reviews to authenticated;
grant usage on sequence public.evidence_use_reviews_sequence_seq to authenticated;
create policy permitted_read on public.evidence_use_reviews for select to authenticated using (
  private.member_role(organization_id) is not null and
  exists(select 1 from public.profile_facts f where f.organization_id=evidence_use_reviews.organization_id and f.id=evidence_use_reviews.fact_id)
);
create policy reviewer_insert on public.evidence_use_reviews for insert to authenticated with check (
  private.member_role(organization_id) in ('organization_admin','executive_approver')
);

create function private.guard_evidence_use_review() returns trigger language plpgsql security definer set search_path='' as $$
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
    raise exception 'Evidence or requirement changed' using errcode='40001';
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
revoke all on function private.guard_evidence_use_review() from public,anon,authenticated;
create trigger guard_review before insert on public.evidence_use_reviews for each row execute function private.guard_evidence_use_review();
create trigger audit_review after insert on public.evidence_use_reviews for each row execute function private.audit_change();

-- Source or classification corrections must also invalidate verification at the database boundary.
create or replace function private.guard_fact_verification() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='UPDATE' and (
    row(new.company_profile_id,new.fact_type,new.label,new.value,new.source_type,new.source_reference,new.source_note,new.effective_date,new.expiration_date,new.owner_user_id,new.notes,new.sensitivity)
    is distinct from
    row(old.company_profile_id,old.fact_type,old.label,old.value,old.source_type,old.source_reference,old.source_note,old.effective_date,old.expiration_date,old.owner_user_id,old.notes,old.sensitivity)
  ) then
    new.verification_status:='pending_verification'; new.verified_by:=null; new.verified_at:=null;
  end if;
  if new.verification_status in ('verified','expiring') and (TG_OP='INSERT' or new.verification_status is distinct from old.verification_status) then
    if auth.uid() is null or coalesce(private.member_role(new.organization_id)::text,'') not in ('organization_admin','executive_approver') then raise exception 'Human verifier required' using errcode='42501'; end if;
    if nullif(btrim(new.source_reference),'') is null then raise exception 'Verification source is required'; end if;
    new.verified_by:=auth.uid(); new.verified_at:=now();
  elsif TG_OP='UPDATE' and new.verification_status=old.verification_status and new.verification_status in ('verified','expiring') then
    new.verified_by:=old.verified_by; new.verified_at:=old.verified_at;
  else new.verified_by:=null; new.verified_at:=null;
  end if;
  return new;
end $$;

create view public.current_evidence_use_reviews with (security_invoker=true) as
select latest.*,
  (latest.proposal_use='approved' and latest.applicability='applicable'
   and latest.fact_version=f.updated_at and latest.requirement_version=r.updated_at
   and f.verification_status in ('verified','expiring') and f.verified_by is not null and f.verified_at is not null
   and nullif(btrim(f.value),'') is not null and nullif(btrim(f.source_reference),'') is not null
   and nullif(btrim(r.citation),'') is not null and f.sensitivity<>'unknown'
   and (f.expiration_date is null or f.expiration_date >= (now() at time zone 'UTC')::date)
   and (f.effective_date is null or f.effective_date <= (now() at time zone 'UTC')::date)
   and m.status='active' and m.role in ('organization_admin','executive_approver')) as approval_current
from (select distinct on (organization_id,requirement_id,fact_id) * from public.evidence_use_reviews
      order by organization_id,requirement_id,fact_id,reviewed_at desc,sequence desc) latest
join public.profile_facts f on f.organization_id=latest.organization_id and f.id=latest.fact_id
join public.pursuit_requirements r on r.organization_id=latest.organization_id and r.id=latest.requirement_id
left join public.organization_memberships m on m.organization_id=latest.organization_id and m.user_id=latest.reviewed_by;
revoke all on public.current_evidence_use_reviews from public,anon;
grant select on public.current_evidence_use_reviews to authenticated;

