-- Collaborative AI doc editor — core schema (Epic A)
-- Target project ref: jnfebpmkcejmclmoqiky (apply via Supabase CLI or Dashboard SQL)
--
-- SECURITY: policies below allow anon + authenticated full CRUD so the dashboard can use
-- NEXT_PUBLIC_DOCS_SUPABASE_ANON_KEY before Supabase Auth is wired. Replace with
-- row-scoped policies before exposing the anon key in any public client.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text,
  default_model text
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  title text,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_one_per_chat unique (chat_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  role text not null,
  content text,
  created_at timestamptz not null default now(),
  model text,
  usage jsonb,
  metadata jsonb not null default '{}'::jsonb,
  sort_key bigint,
  constraint messages_role_check check (
    role in ('user', 'assistant', 'system')
  )
);

create index messages_chat_id_created_at_idx
  on public.messages (chat_id, created_at);

-- Explicit grants (Supabase: anon / authenticated / service_role)
grant all on table public.chats to postgres, anon, authenticated, service_role;
grant all on table public.documents to postgres, anon, authenticated, service_role;
grant all on table public.messages to postgres, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- updated_at trigger for documents
-- ---------------------------------------------------------------------------

create or replace function public.collab_docs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger collab_documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.collab_docs_set_updated_at();

comment on function public.collab_docs_set_updated_at() is
  'Sets documents.updated_at on row update (collaborative doc editor).';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.chats enable row level security;
alter table public.documents enable row level security;
alter table public.messages enable row level security;

-- anon: browser client with publishable key (MVP — tighten later)
create policy collab_chats_anon_all
  on public.chats
  for all
  to anon
  using (true)
  with check (true);

create policy collab_documents_anon_all
  on public.documents
  for all
  to anon
  using (true)
  with check (true);

create policy collab_messages_anon_all
  on public.messages
  for all
  to anon
  using (true)
  with check (true);

-- authenticated: Supabase Auth (when enabled)
create policy collab_chats_authenticated_all
  on public.chats
  for all
  to authenticated
  using (true)
  with check (true);

create policy collab_documents_authenticated_all
  on public.documents
  for all
  to authenticated
  using (true)
  with check (true);

create policy collab_messages_authenticated_all
  on public.messages
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Realtime: Postgres changes
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.chats;
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.messages;
