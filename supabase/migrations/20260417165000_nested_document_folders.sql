-- Collaborative AI doc editor — nested folders support

alter table public.document_folders
add column parent_id uuid references public.document_folders (id) on delete set null;

create index document_folders_parent_id_name_idx
  on public.document_folders (parent_id, name);
