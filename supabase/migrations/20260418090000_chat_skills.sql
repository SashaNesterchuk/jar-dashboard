-- Collaborative AI doc editor — chat skills (preset system contexts)

create table public.chat_skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  prompt text not null check (char_length(trim(prompt)) > 0),
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_skills_slug_unique unique (slug)
);

create index chat_skills_active_sort_idx
  on public.chat_skills (is_active, sort_order, name);

grant all on table public.chat_skills to postgres, service_role;
grant select on table public.chat_skills to anon, authenticated;

create or replace function public.collab_chat_skills_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger collab_chat_skills_set_updated_at
  before update on public.chat_skills
  for each row
  execute function public.collab_chat_skills_set_updated_at();

comment on function public.collab_chat_skills_set_updated_at() is
  'Sets chat_skills.updated_at on row update (collaborative doc editor).';

alter table public.chat_skills enable row level security;

create policy collab_chat_skills_read_anon
  on public.chat_skills
  for select
  to anon
  using (is_active = true);

create policy collab_chat_skills_read_authenticated
  on public.chat_skills
  for select
  to authenticated
  using (is_active = true);

-- Seed a couple of starter skills. Updates are idempotent via on conflict.
insert into public.chat_skills (slug, name, description, prompt, icon, sort_order)
values
  (
    'product_manager',
    'Product manager',
    'Reviews the document as an experienced product manager.',
    'You are an experienced product manager. Review the document with an eye on user value, scope clarity, measurable success criteria, and sequencing. Call out risky assumptions and suggest concrete, prioritized improvements.',
    'briefcase',
    10
  ),
  (
    'analyst',
    'Analyst',
    'Approaches the document as a data / business analyst.',
    'You are a rigorous analyst. Evaluate the document for clarity of the problem statement, quality of evidence, logical consistency, and quantifiable claims. Point out unsupported statements and propose what data would strengthen them.',
    'chart-line',
    20
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  prompt = excluded.prompt,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true;
