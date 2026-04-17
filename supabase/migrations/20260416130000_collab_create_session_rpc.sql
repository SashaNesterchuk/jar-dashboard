-- Atomic create: one chat + one document (Epic B — API / service role)
create or replace function public.collab_create_chat_with_document(p_title text default null)
returns table (chat_id uuid, document_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  c_id uuid;
  d_id uuid;
  v_title text;
begin
  v_title := nullif(trim(p_title), '');
  if v_title is null then
    v_title := 'Untitled';
  end if;

  insert into public.chats (title)
  values (v_title)
  returning id into c_id;

  insert into public.documents (chat_id, title, content)
  values (c_id, v_title, '')
  returning id into d_id;

  return query select c_id, d_id;
end;
$$;

comment on function public.collab_create_chat_with_document(text) is
  'Creates chats row + documents row in one transaction (collaborative doc editor).';

revoke all on function public.collab_create_chat_with_document(text) from public;
grant execute on function public.collab_create_chat_with_document(text) to service_role;
