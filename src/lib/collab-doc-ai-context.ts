/** IDs stored on user messages; always lists the open document first, then optional extras. */
export function aiContextDocumentIds(
  documentId: string | null,
  extraIds: string[]
): string[] {
  if (!documentId) return [...extraIds];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [documentId, ...extraIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
