create table public.ai_change_candidates (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  base_document_content text not null,
  candidate_document_content text not null,
  model text not null,
  chat_reply text not null,
  status text not null default 'pending',
  usage jsonb,
  latency_ms integer,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  applied_by text,
  constraint ai_change_candidates_status_check check (
    status in ('pending', 'applied', 'rejected', 'superseded')
  )
);

create index ai_change_candidates_chat_created_idx
  on public.ai_change_candidates (chat_id, created_at desc);

create index ai_change_candidates_doc_created_idx
  on public.ai_change_candidates (document_id, created_at desc);

grant all on table public.ai_change_candidates to postgres, anon, authenticated, service_role;
