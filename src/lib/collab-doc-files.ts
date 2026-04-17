export const COLLAB_IMPORT_MAX_BYTES = 8 * 1024 * 1024;

export function safeDownloadBasename(raw: string, fallback: string): string {
  const t = raw.trim() || fallback;
  const cleaned = t
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}
