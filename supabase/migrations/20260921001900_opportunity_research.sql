-- Personal research preferences and append-only request metadata; no source activation.
create table public.research_saved_searches (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations,
 user_id uuid not null default auth.uid() references auth.users,
 name text not null check(length(name) between 1 and 120),
 prompt text not null check(length(prompt) between 1 and 3000),
 plan jsonb not null check(jsonb_typeof(plan)='object' and octet_length(plan::text)<=12000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.research_saved_searches enable row level security;
revoke all on public.research_saved_searches from anon,authenticated;
grant select,insert,delete on public.research_saved_searches to authenticated;
create policy own_read on public.research_saved_searches for select to authenticated using(user_id=auth.uid() and private.member_role(organization_id) is not null);
create policy own_insert on public.research_saved_searches for insert to authenticated with check(user_id=auth.uid() and private.member_role(organization_id) is not null);
create policy own_delete on public.research_saved_searches for delete to authenticated using(user_id=auth.uid() and private.member_role(organization_id) is not null);
create table public.research_run_audit (
 id uuid primary key,
 organization_id uuid not null references public.organizations,
 user_id uuid not null default auth.uid() references auth.users,
 filter_digest text not null check(filter_digest ~ '^[a-f0-9]{64}$'),
 sources text[] not null check(cardinality(sources)<=10 and sources <@ array['workspace','sam.gov']::text[]),
 reviewed integer not null check(reviewed between 0 and 400),
 returned integer not null check(returned between 0 and 10),
 partial boolean not null,
 result_ids uuid[] not null check(cardinality(result_ids)<=10),
 created_at timestamptz not null default now()
);
alter table public.research_run_audit enable row level security;
revoke all on public.research_run_audit from anon,authenticated;
grant select,insert on public.research_run_audit to authenticated;
create policy own_read on public.research_run_audit for select to authenticated using(user_id=auth.uid() and private.member_role(organization_id) is not null);
create policy own_insert on public.research_run_audit for insert to authenticated with check(user_id=auth.uid() and private.member_role(organization_id) is not null);
create index research_search_owner on public.research_saved_searches(organization_id,user_id,created_at desc);
create index research_audit_owner on public.research_run_audit(organization_id,user_id,created_at desc);
comment on table public.research_run_audit is 'User-scoped request metadata, not an approval or authoritative qualification finding. No prompts or company fact values.';
