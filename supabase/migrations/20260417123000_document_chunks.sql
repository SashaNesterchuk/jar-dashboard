create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null,
  section_path text,
  content text not null,
  token_estimate integer not null default 0,
  char_start integer not null default 0,
  char_end integer not null default 0,
  content_hash text not null,
  keywords text[] not null default '{}',
  embedding double precision[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_chunks_document_index_unique unique (document_id, chunk_index)
);

create index document_chunks_document_idx
  on public.document_chunks (document_id, chunk_index);

create index document_chunks_tokens_idx
  on public.document_chunks (document_id, token_estimate);

create or replace function public.set_document_chunks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_document_chunks_updated_at on public.document_chunks;
create trigger trg_document_chunks_updated_at
before update on public.document_chunks
for each row execute procedure public.set_document_chunks_updated_at();

grant all on table public.document_chunks to postgres, anon, authenticated, service_role;
