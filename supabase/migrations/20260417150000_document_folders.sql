-- Collaborative AI doc editor — folders support

create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_folders_name_unique unique (name)
);

alter table public.documents
add column folder_id uuid references public.document_folders (id) on delete set null;

create index documents_folder_id_updated_at_idx
  on public.documents (folder_id, updated_at desc);

grant all on table public.document_folders to postgres, anon, authenticated, service_role;

create or replace function public.collab_doc_folders_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger collab_document_folders_set_updated_at
  before update on public.document_folders
  for each row
  execute function public.collab_doc_folders_set_updated_at();

comment on function public.collab_doc_folders_set_updated_at() is
  'Sets document_folders.updated_at on row update (collaborative doc editor).';

alter table public.document_folders enable row level security;

create policy collab_document_folders_anon_all
  on public.document_folders
  for all
  to anon
  using (true)
  with check (true);

create policy collab_document_folders_authenticated_all
  on public.document_folders
  for all
  to authenticated
  using (true)
  with check (true);

alter publication supabase_realtime add table public.document_folders;
