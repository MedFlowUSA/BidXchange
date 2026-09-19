create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.organization_role as enum ('organization_admin','executive_approver','capture_manager','estimator','contributor','viewer');
create type public.verification_state as enum ('unverified','pending_verification','verified','expiring','expired','rejected');

create table public.organizations (
  id uuid primary key default gen_random_uuid(), legal_name text not null check(length(legal_name) between 1 and 200),
  operating_name text not null check(length(operating_name) between 1 and 200), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  website text, organization_type text not null default 'Contractor', status text not null default 'onboarding' check(status in ('onboarding','active','suspended')),
  default_timezone text not null default 'America/Los_Angeles', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id),
  role public.organization_role not null default 'viewer', status text not null default 'active' check(status in ('active','invited','suspended')),
  invited_at timestamptz, accepted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,user_id), unique(organization_id,id)
);
create function private.member_role(org uuid) returns public.organization_role language sql stable security definer set search_path = '' as $$
  select m.role from public.organization_memberships m join public.organizations o on o.id=m.organization_id
  where m.organization_id=org and m.user_id=(select auth.uid()) and m.status='active' and o.status<>'suspended'
$$;
revoke all on function private.member_role(uuid) from public;
grant execute on function private.member_role(uuid) to authenticated;

create table public.company_profiles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null unique references public.organizations(id), summary text,
  service_territory text, minimum_project_value numeric(18,2) check(minimum_project_value >= 0), maximum_project_value numeric(18,2) check(maximum_project_value >= 0),
  profile_status text not null default 'onboarding', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id), check(maximum_project_value is null or minimum_project_value is null or maximum_project_value >= minimum_project_value)
);
create table public.profile_facts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), company_profile_id uuid not null,
  fact_type text not null, label text not null, value text, verification_status public.verification_state not null default 'unverified',
  source_type text, source_reference text, source_note text, effective_date date, expiration_date date,
  verified_by uuid references auth.users(id), verified_at timestamptz, owner_user_id uuid references auth.users(id), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,company_profile_id) references public.company_profiles(organization_id,id), unique(organization_id,fact_type,label), unique(organization_id,id),
  check(verification_status not in ('verified','expiring') or (verified_by is not null and verified_at is not null and nullif(btrim(source_reference),'') is not null))
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), actor_user_id uuid,
  entity_table text not null, entity_id uuid not null, action text not null, previous_record jsonb, next_record jsonb,
  created_at timestamptz not null default now()
);
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb; tenant uuid;
begin
  if TG_OP='DELETE' then row_data:=to_jsonb(old); else row_data:=to_jsonb(new); end if;
  tenant:=case when TG_TABLE_NAME='organizations' then (row_data->>'id')::uuid else (row_data->>'organization_id')::uuid end;
  insert into public.audit_events(organization_id,actor_user_id,entity_table,entity_id,action,previous_record,next_record)
  values(tenant,auth.uid(),TG_TABLE_NAME,(row_data->>'id')::uuid,TG_OP,case when TG_OP<>'INSERT' then to_jsonb(old) end,case when TG_OP<>'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end $$;
create function private.guard_tenant() returns trigger language plpgsql set search_path='' as $$
begin
  if new.organization_id<>old.organization_id or new.id<>old.id then raise exception 'Tenant and record identity are immutable' using errcode='42501'; end if;
  new.updated_at:=now(); return new;
end $$;
create function private.guard_fact_verification() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='UPDATE' and (new.value is distinct from old.value or new.source_reference is distinct from old.source_reference or new.expiration_date is distinct from old.expiration_date) then
    new.verification_status:='pending_verification'; new.verified_by:=null; new.verified_at:=null;
  end if;
  if new.verification_status in ('verified','expiring') and (TG_OP='INSERT' or new.verification_status is distinct from old.verification_status) then
    if auth.uid() is null or private.member_role(new.organization_id) not in ('organization_admin','executive_approver') then raise exception 'Human verifier required' using errcode='42501'; end if;
    if nullif(btrim(new.source_reference),'') is null then raise exception 'Verification source is required'; end if;
    new.verified_by:=auth.uid(); new.verified_at:=now();
  elsif TG_OP='UPDATE' and new.verification_status=old.verification_status and new.verification_status in ('verified','expiring') then
    new.verified_by:=old.verified_by; new.verified_at:=old.verified_at;
  else new.verified_by:=null; new.verified_at:=null;
  end if;
  return new;
end $$;
create trigger verify_fact before insert or update on public.profile_facts for each row execute function private.guard_fact_verification();

-- Organization locks serialize last-administrator changes.
create function private.guard_membership() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='UPDATE' and (new.user_id<>old.user_id or new.organization_id<>old.organization_id or new.id<>old.id) then raise exception 'Membership identity is immutable'; end if;
  if old.role='organization_admin' and old.status='active' then
    perform 1 from public.organizations where id=old.organization_id for update;
    if (TG_OP='DELETE' or new.role<>'organization_admin' or new.status<>'active') and not exists(select 1 from public.organization_memberships where organization_id=old.organization_id and id<>old.id and role='organization_admin' and status='active') then raise exception 'Keep at least one active administrator'; end if;
  end if;
  return coalesce(new,old);
end $$;
create trigger protect_last_admin before update or delete on public.organization_memberships for each row execute function private.guard_membership();

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.audit_events enable row level security;
create policy organization_read on public.organizations for select to authenticated using (private.member_role(id) is not null);
create policy organization_update on public.organizations for update to authenticated using(private.member_role(id)='organization_admin') with check(private.member_role(id)='organization_admin');
create policy membership_read on public.organization_memberships for select to authenticated using(private.member_role(organization_id) is not null);
create policy membership_admin on public.organization_memberships for all to authenticated using(private.member_role(organization_id)='organization_admin') with check(private.member_role(organization_id)='organization_admin');
create policy audit_admin_read on public.audit_events for select to authenticated using(private.member_role(organization_id) in ('organization_admin','executive_approver'));
revoke all on public.audit_events from anon,authenticated;
grant select on public.audit_events to authenticated;
grant select,update on public.organizations to authenticated;
grant select,insert,update,delete on public.organization_memberships to authenticated;
revoke all on public.organizations,public.organization_memberships from anon;
create trigger audit_organization after insert or update on public.organizations for each row execute function private.audit_change();
create trigger audit_membership after insert or update or delete on public.organization_memberships for each row execute function private.audit_change();

-- Structured records reference authoritative, individually verified profile facts.
create table public.licenses (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 fact_id uuid not null, license_number text not null, classification text not null, jurisdiction text, unique(organization_id,license_number,classification),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create table public.registrations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 fact_id uuid not null, registration_type text not null, identifier text not null, unique(organization_id,registration_type,identifier),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create table public.capabilities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 fact_id uuid not null, name text not null, warning text, unique(organization_id,name),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create table public.naics_codes (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 fact_id uuid not null, code text not null check(code ~ '^[0-9]{6}$'), description text, is_primary boolean not null default false, unique(organization_id,code),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create table public.service_territories (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 fact_id uuid not null, name text not null, geographic_restrictions text, unique(organization_id,name),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create table public.insurance_records (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 fact_id uuid not null, carrier text, policy_type text, policy_number text, coverage_limit numeric(18,2), expiration_date date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create table public.bonding_records (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 fact_id uuid not null, surety text, single_project_limit numeric(18,2), aggregate_limit numeric(18,2), expiration_date date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create table public.certifications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 fact_id uuid not null, name text not null, issuer text, identifier text, expiration_date date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create table public.past_performance (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 fact_id uuid not null, project_name text not null, client_name text, completed_date date, contract_value numeric(18,2), reference_contact text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create table public.key_personnel (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 fact_id uuid not null, full_name text not null, position_title text, qualifications text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create table public.approved_subcontractors (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 fact_id uuid not null, legal_name text not null, trade text, license_number text, approved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,fact_id) references public.profile_facts(organization_id,id)
);
create table public.company_documents (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 title text not null, storage_path text, document_type text not null, version integer not null default 1, sha256 text, scan_status text not null default 'not_uploaded' check(scan_status in ('not_uploaded','pending','clean','rejected')), unique(organization_id,storage_path),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.source_preferences (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null, enabled boolean not null default true, access_status text not null default 'not_configured', notes text, unique(organization_id,name),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.onboarding_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 label text not null, status text not null default 'needs_information' check(status in ('needs_information','pending_review','complete')), notes text, unique(organization_id,label),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.opportunities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 title text not null, solicitation_number text, buyer text, source_url text, source_note text, official_deadline timestamptz, deadline_timezone text not null default 'America/Los_Angeles', summary text, estimated_value numeric(18,2), status text not null default 'inbox',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.pursuits (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 opportunity_id uuid not null, title text not null, decision text not null default 'pending' check(decision in ('pending','bid','no_bid')), decision_reason text, decided_by uuid references auth.users(id), decided_at timestamptz, status text not null default 'in_review', foreign key(organization_id,opportunity_id) references public.opportunities(organization_id,id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.pursuit_tasks (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null, title text not null, status text not null default 'todo' check(status in ('todo','in_progress','complete')), assigned_user_id uuid, due_at timestamptz, due_timezone text, foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id), foreign key(organization_id,assigned_user_id) references public.organization_memberships(organization_id,user_id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.pursuit_requirements (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null, requirement text not null, citation text, status text not null default 'needs_review', owner_user_id uuid, foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id), foreign key(organization_id,owner_user_id) references public.organization_memberships(organization_id,user_id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.pursuit_questions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null, question text not null, answer text, source_reference text, foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.proposal_sections (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null, title text not null, content text, status text not null default 'draft', foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.pursuit_risks (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null, description text not null, severity text not null default 'review', mitigation text, foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.pursuit_reviews (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null, review_type text not null, status text not null default 'pending', notes text, foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.pursuit_approvals (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null, approval_type text not null, status text not null default 'pending' check(status='pending'), approver_user_id uuid, foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id), foreign key(organization_id,approver_user_id) references public.organization_memberships(organization_id,user_id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.submission_records (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 pursuit_id uuid not null, status text not null default 'not_submitted' check(status='not_submitted'), receipt_reference text check(receipt_reference is null), foreign key(organization_id,pursuit_id) references public.pursuits(organization_id,id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);

alter table public.company_profiles enable row level security;
revoke all on public.company_profiles from anon,authenticated;
grant select,insert,update,delete on public.company_profiles to authenticated;
create policy tenant_read on public.company_profiles for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.company_profiles for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.company_profiles for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.company_profiles for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.company_profiles for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.company_profiles for each row execute function private.audit_change();
create index company_profiles_tenant_idx on public.company_profiles(organization_id);

alter table public.profile_facts enable row level security;
revoke all on public.profile_facts from anon,authenticated;
grant select,insert,update,delete on public.profile_facts to authenticated;
create policy tenant_read on public.profile_facts for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.profile_facts for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.profile_facts for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.profile_facts for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.profile_facts for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.profile_facts for each row execute function private.audit_change();
create index profile_facts_tenant_idx on public.profile_facts(organization_id);

alter table public.licenses enable row level security;
revoke all on public.licenses from anon,authenticated;
grant select,insert,update,delete on public.licenses to authenticated;
create policy tenant_read on public.licenses for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.licenses for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.licenses for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.licenses for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.licenses for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.licenses for each row execute function private.audit_change();
create index licenses_tenant_idx on public.licenses(organization_id);

alter table public.registrations enable row level security;
revoke all on public.registrations from anon,authenticated;
grant select,insert,update,delete on public.registrations to authenticated;
create policy tenant_read on public.registrations for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.registrations for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.registrations for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.registrations for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.registrations for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.registrations for each row execute function private.audit_change();
create index registrations_tenant_idx on public.registrations(organization_id);

alter table public.capabilities enable row level security;
revoke all on public.capabilities from anon,authenticated;
grant select,insert,update,delete on public.capabilities to authenticated;
create policy tenant_read on public.capabilities for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.capabilities for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.capabilities for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.capabilities for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.capabilities for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.capabilities for each row execute function private.audit_change();
create index capabilities_tenant_idx on public.capabilities(organization_id);

alter table public.naics_codes enable row level security;
revoke all on public.naics_codes from anon,authenticated;
grant select,insert,update,delete on public.naics_codes to authenticated;
create policy tenant_read on public.naics_codes for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.naics_codes for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.naics_codes for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.naics_codes for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.naics_codes for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.naics_codes for each row execute function private.audit_change();
create index naics_codes_tenant_idx on public.naics_codes(organization_id);

alter table public.service_territories enable row level security;
revoke all on public.service_territories from anon,authenticated;
grant select,insert,update,delete on public.service_territories to authenticated;
create policy tenant_read on public.service_territories for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.service_territories for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.service_territories for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.service_territories for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.service_territories for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.service_territories for each row execute function private.audit_change();
create index service_territories_tenant_idx on public.service_territories(organization_id);

alter table public.insurance_records enable row level security;
revoke all on public.insurance_records from anon,authenticated;
grant select,insert,update,delete on public.insurance_records to authenticated;
create policy tenant_read on public.insurance_records for select to authenticated using (private.member_role(organization_id) in ('organization_admin','executive_approver','estimator'));
create policy tenant_insert on public.insurance_records for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.insurance_records for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.insurance_records for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.insurance_records for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.insurance_records for each row execute function private.audit_change();
create index insurance_records_tenant_idx on public.insurance_records(organization_id);

alter table public.bonding_records enable row level security;
revoke all on public.bonding_records from anon,authenticated;
grant select,insert,update,delete on public.bonding_records to authenticated;
create policy tenant_read on public.bonding_records for select to authenticated using (private.member_role(organization_id) in ('organization_admin','executive_approver','estimator'));
create policy tenant_insert on public.bonding_records for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.bonding_records for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.bonding_records for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.bonding_records for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.bonding_records for each row execute function private.audit_change();
create index bonding_records_tenant_idx on public.bonding_records(organization_id);

alter table public.certifications enable row level security;
revoke all on public.certifications from anon,authenticated;
grant select,insert,update,delete on public.certifications to authenticated;
create policy tenant_read on public.certifications for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.certifications for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.certifications for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.certifications for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.certifications for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.certifications for each row execute function private.audit_change();
create index certifications_tenant_idx on public.certifications(organization_id);

alter table public.past_performance enable row level security;
revoke all on public.past_performance from anon,authenticated;
grant select,insert,update,delete on public.past_performance to authenticated;
create policy tenant_read on public.past_performance for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.past_performance for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.past_performance for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.past_performance for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.past_performance for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.past_performance for each row execute function private.audit_change();
create index past_performance_tenant_idx on public.past_performance(organization_id);

alter table public.key_personnel enable row level security;
revoke all on public.key_personnel from anon,authenticated;
grant select,insert,update,delete on public.key_personnel to authenticated;
create policy tenant_read on public.key_personnel for select to authenticated using (private.member_role(organization_id) in ('organization_admin','executive_approver','estimator'));
create policy tenant_insert on public.key_personnel for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.key_personnel for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.key_personnel for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.key_personnel for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.key_personnel for each row execute function private.audit_change();
create index key_personnel_tenant_idx on public.key_personnel(organization_id);

alter table public.approved_subcontractors enable row level security;
revoke all on public.approved_subcontractors from anon,authenticated;
grant select,insert,update,delete on public.approved_subcontractors to authenticated;
create policy tenant_read on public.approved_subcontractors for select to authenticated using (private.member_role(organization_id) in ('organization_admin','executive_approver','estimator'));
create policy tenant_insert on public.approved_subcontractors for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.approved_subcontractors for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.approved_subcontractors for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.approved_subcontractors for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.approved_subcontractors for each row execute function private.audit_change();
create index approved_subcontractors_tenant_idx on public.approved_subcontractors(organization_id);

alter table public.company_documents enable row level security;
revoke all on public.company_documents from anon,authenticated;
grant select,insert,update,delete on public.company_documents to authenticated;
create policy tenant_read on public.company_documents for select to authenticated using (private.member_role(organization_id) in ('organization_admin','executive_approver','estimator'));
create policy tenant_insert on public.company_documents for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.company_documents for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.company_documents for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.company_documents for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.company_documents for each row execute function private.audit_change();
create index company_documents_tenant_idx on public.company_documents(organization_id);

alter table public.source_preferences enable row level security;
revoke all on public.source_preferences from anon,authenticated;
grant select,insert,update,delete on public.source_preferences to authenticated;
create policy tenant_read on public.source_preferences for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.source_preferences for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.source_preferences for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.source_preferences for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.source_preferences for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.source_preferences for each row execute function private.audit_change();
create index source_preferences_tenant_idx on public.source_preferences(organization_id);

alter table public.onboarding_items enable row level security;
revoke all on public.onboarding_items from anon,authenticated;
grant select,insert,update,delete on public.onboarding_items to authenticated;
create policy tenant_read on public.onboarding_items for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.onboarding_items for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.onboarding_items for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.onboarding_items for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.onboarding_items for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.onboarding_items for each row execute function private.audit_change();
create index onboarding_items_tenant_idx on public.onboarding_items(organization_id);

alter table public.opportunities enable row level security;
revoke all on public.opportunities from anon,authenticated;
grant select,insert,update,delete on public.opportunities to authenticated;
create policy tenant_read on public.opportunities for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.opportunities for insert to authenticated with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_update on public.opportunities for update to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager')) with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_delete on public.opportunities for delete to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create trigger immutable_tenant before update on public.opportunities for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.opportunities for each row execute function private.audit_change();
create index opportunities_tenant_idx on public.opportunities(organization_id);

alter table public.pursuits enable row level security;
revoke all on public.pursuits from anon,authenticated;
grant select,insert,update,delete on public.pursuits to authenticated;
create policy tenant_read on public.pursuits for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.pursuits for insert to authenticated with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_update on public.pursuits for update to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager')) with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_delete on public.pursuits for delete to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create trigger immutable_tenant before update on public.pursuits for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.pursuits for each row execute function private.audit_change();
create index pursuits_tenant_idx on public.pursuits(organization_id);

alter table public.pursuit_tasks enable row level security;
revoke all on public.pursuit_tasks from anon,authenticated;
grant select,insert,update,delete on public.pursuit_tasks to authenticated;
create policy tenant_read on public.pursuit_tasks for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.pursuit_tasks for insert to authenticated with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_update on public.pursuit_tasks for update to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager')) with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_delete on public.pursuit_tasks for delete to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create trigger immutable_tenant before update on public.pursuit_tasks for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.pursuit_tasks for each row execute function private.audit_change();
create index pursuit_tasks_tenant_idx on public.pursuit_tasks(organization_id);

alter table public.pursuit_requirements enable row level security;
revoke all on public.pursuit_requirements from anon,authenticated;
grant select,insert,update,delete on public.pursuit_requirements to authenticated;
create policy tenant_read on public.pursuit_requirements for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.pursuit_requirements for insert to authenticated with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_update on public.pursuit_requirements for update to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager')) with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_delete on public.pursuit_requirements for delete to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create trigger immutable_tenant before update on public.pursuit_requirements for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.pursuit_requirements for each row execute function private.audit_change();
create index pursuit_requirements_tenant_idx on public.pursuit_requirements(organization_id);

alter table public.pursuit_questions enable row level security;
revoke all on public.pursuit_questions from anon,authenticated;
grant select,insert,update,delete on public.pursuit_questions to authenticated;
create policy tenant_read on public.pursuit_questions for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.pursuit_questions for insert to authenticated with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_update on public.pursuit_questions for update to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager')) with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_delete on public.pursuit_questions for delete to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create trigger immutable_tenant before update on public.pursuit_questions for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.pursuit_questions for each row execute function private.audit_change();
create index pursuit_questions_tenant_idx on public.pursuit_questions(organization_id);

alter table public.proposal_sections enable row level security;
revoke all on public.proposal_sections from anon,authenticated;
grant select,insert,update,delete on public.proposal_sections to authenticated;
create policy tenant_read on public.proposal_sections for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.proposal_sections for insert to authenticated with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_update on public.proposal_sections for update to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager')) with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_delete on public.proposal_sections for delete to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create trigger immutable_tenant before update on public.proposal_sections for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.proposal_sections for each row execute function private.audit_change();
create index proposal_sections_tenant_idx on public.proposal_sections(organization_id);

alter table public.pursuit_risks enable row level security;
revoke all on public.pursuit_risks from anon,authenticated;
grant select,insert,update,delete on public.pursuit_risks to authenticated;
create policy tenant_read on public.pursuit_risks for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.pursuit_risks for insert to authenticated with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_update on public.pursuit_risks for update to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager')) with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_delete on public.pursuit_risks for delete to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create trigger immutable_tenant before update on public.pursuit_risks for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.pursuit_risks for each row execute function private.audit_change();
create index pursuit_risks_tenant_idx on public.pursuit_risks(organization_id);

alter table public.pursuit_reviews enable row level security;
revoke all on public.pursuit_reviews from anon,authenticated;
grant select,insert,update,delete on public.pursuit_reviews to authenticated;
create policy tenant_read on public.pursuit_reviews for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.pursuit_reviews for insert to authenticated with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_update on public.pursuit_reviews for update to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager')) with check (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create policy tenant_delete on public.pursuit_reviews for delete to authenticated using (private.member_role(organization_id) in ('organization_admin','capture_manager'));
create trigger immutable_tenant before update on public.pursuit_reviews for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.pursuit_reviews for each row execute function private.audit_change();
create index pursuit_reviews_tenant_idx on public.pursuit_reviews(organization_id);

alter table public.pursuit_approvals enable row level security;
revoke all on public.pursuit_approvals from anon,authenticated;
grant select,insert,update,delete on public.pursuit_approvals to authenticated;
create policy tenant_read on public.pursuit_approvals for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.pursuit_approvals for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.pursuit_approvals for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.pursuit_approvals for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.pursuit_approvals for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.pursuit_approvals for each row execute function private.audit_change();
create index pursuit_approvals_tenant_idx on public.pursuit_approvals(organization_id);

alter table public.submission_records enable row level security;
revoke all on public.submission_records from anon,authenticated;
grant select,insert,update,delete on public.submission_records to authenticated;
create policy tenant_read on public.submission_records for select to authenticated using (private.member_role(organization_id) is not null);
create policy tenant_insert on public.submission_records for insert to authenticated with check (private.member_role(organization_id)='organization_admin');
create policy tenant_update on public.submission_records for update to authenticated using (private.member_role(organization_id)='organization_admin') with check (private.member_role(organization_id)='organization_admin');
create policy tenant_delete on public.submission_records for delete to authenticated using (private.member_role(organization_id)='organization_admin');
create trigger immutable_tenant before update on public.submission_records for each row execute function private.guard_tenant();
create trigger audit_record after insert or update or delete on public.submission_records for each row execute function private.audit_change();
create index submission_records_tenant_idx on public.submission_records(organization_id);

-- No ordinary role may record a live bid decision in this foundation phase.
create function private.guard_pursuit_decision() returns trigger language plpgsql set search_path='' as $$
begin
 if new.decision<>'pending' or new.decided_by is not null or new.decided_at is not null then raise exception 'Live bid approvals are not enabled in this phase'; end if; return new;
end $$;
create trigger pursuit_decision_guard before insert or update on public.pursuits for each row execute function private.guard_pursuit_decision();
-- Private future storage bucket: no upload/read policies are granted until the scanner workflow exists.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('company-private','company-private',false,10485760,array['application/pdf']) on conflict(id) do nothing;
revoke all on all functions in schema private from public;
grant execute on function private.member_role(uuid) to authenticated;
