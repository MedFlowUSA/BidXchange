alter table public.onboarding_items
 add column assigned_user_id uuid,
 add column due_on date,
 add column passport_section text check(passport_section in ('identity','registrations','licenses','territory','coverage','experience')),
 add column passport_item text check(length(btrim(passport_item)) between 1 and 200),
 add column requested_by uuid references auth.users(id),
 add column last_updated_by uuid references auth.users(id),
 add column completed_by uuid references auth.users(id),
 add column completed_at timestamptz,
 add constraint information_request_owner foreign key(organization_id,assigned_user_id) references public.organization_memberships(organization_id,user_id),
 add constraint information_request_link check((passport_section is null)=(passport_item is null)),
 add constraint information_request_completion check((completed_at is null)=(completed_by is null));
create unique index information_request_passport_item on public.onboarding_items(organization_id,passport_section,passport_item) where passport_section is not null;
create index information_request_due on public.onboarding_items(organization_id,assigned_user_id,due_on) where status<>'complete';

-- All app changes use the checked RPC. Existing tenant reads and audit trigger remain.
revoke insert,update,delete on public.onboarding_items from authenticated;
create function private.information_request_version() returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
 return new;
end $$;
revoke all on function private.information_request_version() from public,anon,authenticated;
create trigger zz_information_request_version before update on public.onboarding_items for each row execute function private.information_request_version();

create function public.save_information_request(
 org uuid,request_id uuid,expected_version timestamptz,request_label text,assignee uuid,
 due_date date,request_status text,request_notes text,section_key text default null,item_key text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare member public.organization_role; old_row public.onboarding_items; result uuid;
begin
 select m.role into member from public.organization_memberships m join public.organizations o on o.id=m.organization_id
   where m.organization_id=org and m.user_id=auth.uid() and m.status='active' and o.status<>'suspended' for share of m;
 if auth.uid() is null or member is null or member='viewer' then raise exception 'Request access required' using errcode='42501'; end if;
 if request_label is null or length(btrim(request_label)) not between 1 and 200 or request_notes is null or length(request_notes)>4000
   or request_status is null or request_status not in ('needs_information','pending_review','complete') then raise exception 'Check request fields'; end if;
 if request_status in ('pending_review','complete') and nullif(btrim(request_notes),'') is null then raise exception 'Explain what is ready for review or why the request is closed'; end if;
 if request_id is null then
   if member<>'organization_admin' or expected_version is not null or request_status<>'needs_information' or due_date is null or assignee is null then raise exception 'Administrator, owner and due date required for a new request' using errcode='42501'; end if;
 else
   select * into old_row from public.onboarding_items i where i.organization_id=org and i.id=request_id for update;
   if not found then raise exception 'Request unavailable' using errcode='42501'; end if;
   if expected_version is null or old_row.updated_at is distinct from expected_version then raise exception 'Request changed; reload before saving'; end if;
   if member<>'organization_admin' and (old_row.assigned_user_id is distinct from auth.uid() or old_row.status='complete'
     or request_status='complete' or request_label is distinct from old_row.label or assignee is distinct from old_row.assigned_user_id
     or due_date is distinct from old_row.due_on or section_key is distinct from old_row.passport_section or item_key is distinct from old_row.passport_item)
     then raise exception 'Assignee may update progress only; administrator review required' using errcode='42501'; end if;
 end if;
 if assignee is not null then
   perform 1 from public.organization_memberships m where m.organization_id=org and m.user_id=assignee and m.status='active' and m.role<>'viewer' for share;
   if not found then raise exception 'Choose an active non-viewer company member'; end if;
   if due_date is null then raise exception 'Assigned requests need a due date'; end if;
 end if;
 if not public.consume_admin_mutation() then raise exception 'Please wait before trying again'; end if;
 if request_id is null then
   insert into public.onboarding_items(organization_id,label,assigned_user_id,due_on,status,notes,passport_section,passport_item,requested_by,last_updated_by)
   values(org,btrim(request_label),assignee,due_date,request_status,btrim(request_notes),section_key,item_key,auth.uid(),auth.uid()) returning id into result;
 else
   update public.onboarding_items i set label=btrim(request_label),assigned_user_id=assignee,due_on=due_date,status=request_status,notes=btrim(request_notes),
     passport_section=section_key,passport_item=item_key,last_updated_by=auth.uid(),
     completed_by=case when request_status='complete' then auth.uid() else null end,
     completed_at=case when request_status='complete' then clock_timestamp() else null end
   where i.organization_id=org and i.id=request_id returning id into result;
 end if;
 return result;
end $$;
revoke all on function public.save_information_request(uuid,uuid,timestamptz,text,uuid,date,text,text,text,text) from public,anon,authenticated;
grant execute on function public.save_information_request(uuid,uuid,timestamptz,text,uuid,date,text,text,text,text) to authenticated;

create function public.information_request_owners(org uuid)
returns table(user_id uuid,email text,role public.organization_role) language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or private.member_role(org) is distinct from 'organization_admin'::public.organization_role then raise exception 'Administrator required' using errcode='42501'; end if;
 return query select m.user_id,u.email::text,m.role from public.organization_memberships m join auth.users u on u.id=m.user_id
 where m.organization_id=org and m.status='active' and m.role<>'viewer' order by u.email;
end $$;
revoke all on function public.information_request_owners(uuid) from public,anon,authenticated;
grant execute on function public.information_request_owners(uuid) to authenticated;
