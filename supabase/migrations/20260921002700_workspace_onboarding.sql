-- Verified-email company creation and invitations. Existing tenant roles remain authoritative.
create table private.workspace_creations (
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  organization_id uuid not null unique references public.organizations(id),
  created_at timestamptz not null default now(),
  primary key(user_id, request_id)
);
revoke all on private.workspace_creations from public, anon, authenticated;

create function private.confirmed_account_email() returns text
language sql stable security definer set search_path='' as $$
  select lower(btrim(email)) from auth.users
  where id=auth.uid() and email_confirmed_at is not null and nullif(btrim(email),'') is not null
$$;
revoke all on function private.confirmed_account_email() from public, anon, authenticated;

create function public.create_company_workspace(legal_name text, operating_name text, request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid; actor uuid:=auth.uid();
begin
  if private.confirmed_account_email() is null then raise exception 'Confirm your email before creating a company' using errcode='42501'; end if;
  if request_id is null or legal_name is null or length(btrim(legal_name)) not between 1 and 200
     or operating_name is null or length(btrim(operating_name)) not between 1 and 200 then
    raise exception 'Enter a legal and operating name' using errcode='22023';
  end if;
  -- Serialize creation for this account, including double-clicks and concurrent requests.
  perform 1 from auth.users where id=actor for update;
  select c.organization_id into org from private.workspace_creations c
    where c.user_id=actor and c.request_id=create_company_workspace.request_id;
  if org is not null then
    if private.member_role(org) is null then raise exception 'Workspace access unavailable' using errcode='42501'; end if;
    return org;
  end if;
  if (select count(*) from private.workspace_creations where user_id=actor)>=3 then
    raise exception 'Contact support to create additional companies' using errcode='P0001';
  end if;
  org:=gen_random_uuid();
  insert into public.organizations(id,legal_name,operating_name,slug)
    values(org,btrim(legal_name),btrim(operating_name),'company-'||org::text);
  insert into public.organization_memberships(organization_id,user_id,role,status,accepted_at)
    values(org,actor,'organization_admin','active',now());
  insert into public.company_profiles(organization_id) values(org);
  insert into private.workspace_creations(user_id,request_id,organization_id)
    values(actor,request_id,org);
  return org;
end $$;
revoke all on function public.create_company_workspace(text,text,uuid) from public,anon;
grant execute on function public.create_company_workspace(text,text,uuid) to authenticated;

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  email text not null check(email=lower(btrim(email)) and length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  role public.organization_role not null,
  status text not null default 'pending' check(status in ('pending','accepted','revoked')),
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now()+interval '7 days',
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index organization_invitation_pending on public.organization_invitations(organization_id,email) where status='pending';
create index organization_invitation_email on public.organization_invitations(email,expires_at) where status='pending';
alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from public,anon,authenticated;
grant select on public.organization_invitations to authenticated;
create policy invitation_admin_read on public.organization_invitations for select to authenticated
  using(private.member_role(organization_id)='organization_admin');
create trigger invitation_audit after insert or update on public.organization_invitations
  for each row execute function private.audit_change();
create trigger invitation_identity before update on public.organization_invitations
  for each row execute function private.guard_tenant();

create function public.invite_company_member(org uuid, invite_email text, invite_role public.organization_role)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation uuid; normalized text:=lower(btrim(invite_email));
begin
  if private.confirmed_account_email() is null or private.member_role(org) is distinct from 'organization_admin' then
    raise exception 'Company administrator required' using errcode='42501';
  end if;
  perform 1 from public.organizations where id=org for update;
  if normalized is null or length(normalized) not between 3 and 254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or invite_role is null then
    raise exception 'Enter an email and role' using errcode='22023';
  end if;
  if exists(select 1 from public.organization_memberships m join auth.users u on u.id=m.user_id
    where m.organization_id=org and lower(btrim(u.email))=normalized and m.status in ('active','suspended')) then
    raise exception 'This account already has a membership; manage its access in Settings' using errcode='P0001';
  end if;
  if (select count(*) from public.organization_invitations where organization_id=org and created_at>now()-interval '1 day')>=50 then
    raise exception 'Daily invitation limit reached' using errcode='P0001';
  end if;
  update public.organization_invitations set status='revoked'
    where organization_id=org and email=normalized and status='pending' and expires_at<=now();
  if exists(select 1 from public.organization_invitations where organization_id=org and email=normalized and status='pending') then
    raise exception 'A pending invitation already exists. Revoke it before changing the role' using errcode='P0001';
  end if;
  insert into public.organization_invitations(organization_id,email,role,invited_by)
    values(org,normalized,invite_role,auth.uid()) returning id into invitation;
  return invitation;
end $$;
revoke all on function public.invite_company_member(uuid,text,public.organization_role) from public,anon;
grant execute on function public.invite_company_member(uuid,text,public.organization_role) to authenticated;

-- A verified recipient can discover only invitations to their current confirmed email.
-- No bearer link, client-supplied email or JWT email claim grants membership.
create function public.my_company_invitations()
returns table(id uuid, organization_name text, role public.organization_role, expires_at timestamptz)
language sql stable security definer set search_path='' as $$
  select i.id,o.operating_name,i.role,i.expires_at
  from public.organization_invitations i join public.organizations o on o.id=i.organization_id
  join public.organization_memberships issuer on issuer.organization_id=i.organization_id and issuer.user_id=i.invited_by
  where i.email=private.confirmed_account_email() and i.status='pending' and i.expires_at>now()
    and o.status<>'suspended' and issuer.status='active' and issuer.role='organization_admin'
  order by i.created_at desc limit 100
$$;
revoke all on function public.my_company_invitations() from public,anon;
grant execute on function public.my_company_invitations() to authenticated;

create function public.accept_company_invitation(invitation_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.organization_invitations; org uuid; member public.organization_memberships; account_email text;
begin
  account_email:=private.confirmed_account_email();
  if account_email is null then raise exception 'Confirm your email first' using errcode='42501'; end if;
  select organization_id into org from public.organization_invitations where id=invitation_id and email=account_email;
  if org is null then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  perform 1 from public.organizations where id=org for update;
  select * into i from public.organization_invitations where id=invitation_id for update;
  if i.status<>'pending' or i.expires_at<=now() or not exists(select 1 from public.organizations where id=org and status<>'suspended')
    or not exists(select 1 from public.organization_memberships where organization_id=org and user_id=i.invited_by and role='organization_admin' and status='active') then
    raise exception 'Invitation expired, revoked or unavailable' using errcode='42501';
  end if;
  select * into member from public.organization_memberships where organization_id=org and user_id=auth.uid() for update;
  if member.status='suspended' then raise exception 'Ask your administrator to restore access' using errcode='42501'; end if;
  if member.id is null then
    insert into public.organization_memberships(organization_id,user_id,role,status,invited_at,accepted_at)
      values(org,auth.uid(),i.role,'active',i.created_at,now());
  elsif member.status='invited' then
    update public.organization_memberships set role=i.role,status='active',accepted_at=now() where id=member.id;
  end if;
  -- Already-active memberships retain their existing role; invitations never elevate them.
  update public.organization_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=i.id;
  return org;
end $$;
revoke all on function public.accept_company_invitation(uuid) from public,anon;
grant execute on function public.accept_company_invitation(uuid) to authenticated;

create function public.revoke_company_invitation(org uuid, invitation_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if private.member_role(org) is distinct from 'organization_admin' then raise exception 'Company administrator required' using errcode='42501'; end if;
  perform 1 from public.organizations where id=org for update;
  update public.organization_invitations set status='revoked' where organization_id=org and id=invitation_id and status='pending';
  return found;
end $$;
revoke all on function public.revoke_company_invitation(uuid,uuid) from public,anon;
grant execute on function public.revoke_company_invitation(uuid,uuid) to authenticated;
