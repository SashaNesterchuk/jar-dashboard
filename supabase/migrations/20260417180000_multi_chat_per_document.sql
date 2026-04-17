-- Multiple chats per document: chats.document_id -> documents; drop documents.chat_id

-- 1. New columns (nullable until backfill)
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS document_id uuid;

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS primary_chat_id uuid;

-- 2. Backfill from legacy 1:1 (documents.chat_id -> chats.id)
UPDATE public.chats c
SET document_id = d.id
FROM public.documents d
WHERE d.chat_id = c.id
  AND c.document_id IS NULL;

UPDATE public.documents d
SET primary_chat_id = d.chat_id
WHERE d.chat_id IS NOT NULL
  AND d.primary_chat_id IS NULL;

-- 3. FK chats -> documents
ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_document_id_fkey;

ALTER TABLE public.chats
  ADD CONSTRAINT chats_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES public.documents (id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.chats VALIDATE CONSTRAINT chats_document_id_fkey;

ALTER TABLE public.chats ALTER COLUMN document_id SET NOT NULL;

-- 4. FK documents.primary_chat_id -> chats (optional pointer for list / default open)
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_primary_chat_id_fkey;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_primary_chat_id_fkey
  FOREIGN KEY (primary_chat_id) REFERENCES public.chats (id) ON DELETE SET NULL NOT VALID;

ALTER TABLE public.documents VALIDATE CONSTRAINT documents_primary_chat_id_fkey;

-- 5. Remove legacy documents.chat_id
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_chat_id_fkey;
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_one_per_chat;
ALTER TABLE public.documents DROP COLUMN IF EXISTS chat_id;

CREATE INDEX IF NOT EXISTS chats_document_id_idx ON public.chats (document_id);

-- 6. Session RPC: document first, then chat
CREATE OR REPLACE FUNCTION public.collab_create_chat_with_document(p_title text default null)
RETURNS TABLE (chat_id uuid, document_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_id uuid;
  d_id uuid;
  v_title text;
BEGIN
  v_title := nullif(trim(p_title), '');
  IF v_title IS NULL THEN
    v_title := 'Untitled';
  END IF;

  INSERT INTO public.documents (title, content)
  VALUES (v_title, '')
  RETURNING id INTO d_id;

  INSERT INTO public.chats (title, document_id)
  VALUES (v_title, d_id)
  RETURNING id INTO c_id;

  UPDATE public.documents
  SET primary_chat_id = c_id
  WHERE id = d_id;

  RETURN QUERY SELECT c_id, d_id;
END;
$$;

COMMENT ON FUNCTION public.collab_create_chat_with_document(text) IS
  'Creates documents row + first chats row (collaborative doc editor).';
