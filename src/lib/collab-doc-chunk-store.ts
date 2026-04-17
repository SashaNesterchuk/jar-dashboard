import { getDocsSupabaseServiceClient } from "@/lib/docs-supabase";
import type { CollabChunkBuild, CollabDocumentChunk } from "@/types/collab-docs";

export async function rebuildDocumentChunks(
  documentId: string,
  chunks: CollabChunkBuild[]
): Promise<{ count: number }> {
  const supabase = getDocsSupabaseServiceClient();
  const { error: delErr } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_id", documentId);
  if (delErr) throw new Error(delErr.message);

  if (chunks.length === 0) return { count: 0 };
  const rows = chunks.map((c) => ({
    document_id: documentId,
    chunk_index: c.chunk_index,
    section_path: c.section_path,
    content: c.content,
    token_estimate: c.token_estimate,
    char_start: c.char_start,
    char_end: c.char_end,
    content_hash: c.content_hash,
    keywords: c.keywords,
  }));
  const { error: insErr } = await supabase.from("document_chunks").insert(rows);
  if (insErr) throw new Error(insErr.message);
  return { count: rows.length };
}

export async function loadDocumentChunks(
  documentIds: string[]
): Promise<CollabDocumentChunk[]> {
  if (documentIds.length === 0) return [];
  const supabase = getDocsSupabaseServiceClient();
  const { data, error } = await supabase
    .from("document_chunks")
    .select(
      "id, document_id, chunk_index, section_path, content, token_estimate, char_start, char_end, content_hash, keywords, embedding, created_at, updated_at"
    )
    .in("document_id", documentIds)
    .order("chunk_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CollabDocumentChunk[];
}
