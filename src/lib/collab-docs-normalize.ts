import type { CollabChat, CollabDocument, CollabDocumentListRow } from "@/types/collab-docs";

export function normalizeEmbeddedChat(chatsRaw: unknown): CollabChat | null {
  if (chatsRaw == null) return null;
  if (Array.isArray(chatsRaw)) {
    return (chatsRaw[0] as CollabChat | undefined) ?? null;
  }
  return chatsRaw as CollabChat;
}

export function normalizeDocumentListRow(
  raw: Record<string, unknown>
): CollabDocumentListRow {
  return {
    id: raw.id as string,
    chat_id: raw.chat_id as string,
    title: raw.title as string | null,
    content: raw.content as string | null,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    chats: normalizeEmbeddedChat(raw.chats),
  };
}

export type DocWithChat = CollabDocument & { chats: CollabChat | null };

export function normalizeDocWithChat(raw: Record<string, unknown>): DocWithChat {
  return {
    id: raw.id as string,
    chat_id: raw.chat_id as string,
    title: raw.title as string | null,
    content: raw.content as string | null,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    chats: normalizeEmbeddedChat(raw.chats),
  };
}
