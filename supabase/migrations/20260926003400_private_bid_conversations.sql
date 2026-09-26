-- Opt-in private checkpoints; encrypted server-issued content, never shared workspace chat.
create table public.ai_bid_conversations (
  organization_id uuid not null references public.organizations(id),
  pursuit_id uuid not null,
  user_id uuid not null references auth.users(id),
  checkpoint_id uuid not null,
  role public.organization_role not null,
  encrypted_payload text not null check (octet_length(encrypted_payload) between 40 and 150000),
  saved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (organization_id,user_id,pursuit_id),
  foreign key (organization_id,pursuit_id) references public.pursuits(organization_id,id),
  check (expires_at > saved_at and expires_at <= saved_at + interval '31 days')
);
alter table public.ai_bid_conversations enable row level security;
revoke all on public.ai_bid_conversations from anon, authenticated;
grant select,insert,update,delete on public.ai_bid_conversations to authenticated;
create policy own_bid_conversation_read on public.ai_bid_conversations for select to authenticated
using (user_id=auth.uid() and private.member_role(organization_id)=role);
create policy own_bid_conversation_insert on public.ai_bid_conversations for insert to authenticated
with check (user_id=auth.uid() and private.member_role(organization_id)=role and
  exists(select 1 from public.pursuits p where p.organization_id=ai_bid_conversations.organization_id and p.id=pursuit_id));
create policy own_bid_conversation_update on public.ai_bid_conversations for update to authenticated
using (user_id=auth.uid() and private.member_role(organization_id) is not null)
with check (user_id=auth.uid() and private.member_role(organization_id)=role and
  exists(select 1 from public.pursuits p where p.organization_id=ai_bid_conversations.organization_id and p.id=pursuit_id));
create policy own_bid_conversation_delete on public.ai_bid_conversations for delete to authenticated
using (user_id=auth.uid() and private.member_role(organization_id) is not null);

-- No transcript audit trigger: application usage logs remain metadata-only.
comment on table public.ai_bid_conversations is 'Private opt-in encrypted BidBuddy checkpoints. Expired content is inaccessible in the API; replacement/deletion removes the stored row payload. No legal decisions or task permissions are stored here.';
