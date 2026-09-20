-- Private immutable objects; no client storage policies are introduced.
create table public.document_libraries (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 title text not null check(length(btrim(title)) between 1 and 200), created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.document_versions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 document_id uuid not null, version integer not null check(version>0),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), byte_size integer not null check(byte_size between 1 and 2097152),
 scan_status text not null default 'pending' check(scan_status in ('pending','clean','rejected')),
 scanner_version text, scanned_at timestamptz, uploaded_at timestamptz,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(organization_id,document_id) references public.document_libraries(organization_id,id),
 unique(organization_id,id), unique(document_id,version),
 check((scan_status='pending' and scanner_version is null and scanned_at is null) or (scan_status<>'pending' and scanner_version is not null and scanned_at is not null))
);
create table public.requirement_document_links (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 requirement_id uuid not null, document_version_id uuid not null,
 source_reference text not null check(length(btrim(source_reference)) between 1 and 2000),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(organization_id,requirement_id) references public.pursuit_requirements(organization_id,id),
 foreign key(organization_id,document_version_id) references public.document_versions(organization_id,id),
 unique(requirement_id,document_version_id,source_reference)
);
alter table public.document_libraries enable row level security;
alter table public.document_versions enable row level security;
alter table public.requirement_document_links enable row level security;
revoke all on public.document_libraries,public.document_versions,public.requirement_document_links from public,anon,authenticated;
grant select on public.document_libraries,public.document_versions,public.requirement_document_links to authenticated;
grant select on public.document_libraries,public.document_versions to service_role;
create policy member_read on public.document_libraries for select to authenticated using(private.member_role(organization_id) in ('organization_admin','executive_approver','estimator'));
create policy member_read on public.document_versions for select to authenticated using(private.member_role(organization_id) in ('organization_admin','executive_approver','estimator'));
create policy member_read on public.requirement_document_links for select to authenticated using(private.member_role(organization_id) in ('organization_admin','executive_approver','estimator'));
create index document_versions_pending_idx on public.document_versions(created_at) where scan_status='pending';
create index document_versions_org_idx on public.document_versions(organization_id,document_id,version);
create index requirement_document_links_org_idx on public.requirement_document_links(organization_id,requirement_id);
create trigger audit_record after insert on public.document_libraries for each row execute function private.audit_change();
create trigger audit_record after insert or update on public.document_versions for each row execute function private.audit_change();
create trigger audit_record after insert on public.requirement_document_links for each row execute function private.audit_change();

create function public.reserve_document_version(org uuid, existing_document uuid, document_title text, content_hash text, content_size integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare doc uuid; result uuid; next_version integer;
begin
 if private.member_role(org) is distinct from 'organization_admin' then raise exception 'Document administrator required' using errcode='42501'; end if;
 if content_hash is null or content_hash !~ '^[a-f0-9]{64}$' or content_size is null or content_size not between 1 and 2097152 then raise exception 'Invalid document'; end if;
 -- Serialize reservations per organization, including quota checks.
 perform 1 from public.organizations where id=org for update;
 if (select count(*) from public.document_versions where organization_id=org and created_at>now()-interval '1 day')>=50 then raise exception 'Daily upload limit reached'; end if;
 if (select coalesce(sum(byte_size),0) from public.document_versions where organization_id=org)+content_size>104857600 then raise exception 'Document storage limit reached'; end if;
 if not public.consume_admin_mutation() then raise exception 'Try later'; end if;
 if existing_document is null then
  insert into public.document_libraries(organization_id,title,created_by) values(org,btrim(document_title),auth.uid()) returning id into doc;
 else
  select id into doc from public.document_libraries where id=existing_document and organization_id=org for update;
  if doc is null then raise exception 'Document unavailable'; end if;
 end if;
 select coalesce(max(version),0)+1 into next_version from public.document_versions where document_id=doc;
 insert into public.document_versions(organization_id,document_id,version,sha256,byte_size,created_by) values(org,doc,next_version,content_hash,content_size,auth.uid()) returning id into result;
 return result;
end $$;
revoke all on function public.reserve_document_version(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_document_version(uuid,uuid,text,text,integer) to authenticated;

create function public.confirm_document_upload(target uuid, expected_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.document_versions set uploaded_at=clock_timestamp() where id=target and sha256=expected_hash and uploaded_at is null and scan_status='pending';
 return found;
end $$;
revoke all on function public.confirm_document_upload(uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_document_upload(uuid,text) to service_role;

create function public.finish_document_scan(target uuid, expected_hash text, verdict text, engine text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if verdict is null or verdict not in ('clean','rejected') or engine is null or length(btrim(engine)) not between 1 and 300 then raise exception 'Invalid scan result'; end if;
 update public.document_versions set scan_status=verdict,scanner_version=engine,scanned_at=clock_timestamp()
 where id=target and sha256=expected_hash and scan_status='pending' and uploaded_at is not null;
 return found;
end $$;
revoke all on function public.finish_document_scan(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_document_scan(uuid,text,text,text) to service_role;

create function public.link_requirement_document(org uuid, target_requirement uuid, expected_version timestamptz, source_version uuid, reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; actual timestamptz;
begin
 if private.member_role(org) is distinct from 'organization_admin' then raise exception 'Document administrator required' using errcode='42501'; end if;
 select updated_at into actual from public.pursuit_requirements where organization_id=org and id=target_requirement for update;
 if actual is null or expected_version is null or actual<>expected_version then raise exception 'Requirement changed'; end if;
 if not exists(select 1 from public.document_versions where organization_id=org and id=source_version and scan_status='clean') then raise exception 'Scanned document unavailable'; end if;
 if not public.consume_admin_mutation() then raise exception 'Try later'; end if;
 insert into public.requirement_document_links(organization_id,requirement_id,document_version_id,source_reference,created_by)
 values(org,target_requirement,source_version,btrim(reference),auth.uid()) returning id into result;
 -- A new source reference requires a new assessment of the requirement.
 update public.pursuit_requirements set updated_at=clock_timestamp() where organization_id=org and id=target_requirement;
 return result;
end $$;
revoke all on function public.link_requirement_document(uuid,uuid,timestamptz,uuid,text) from public,anon,authenticated;
grant execute on function public.link_requirement_document(uuid,uuid,timestamptz,uuid,text) to authenticated;
