/** Row shapes for collaborative doc editor (Supabase project docs). */

export type CollabChat = {
  id: string;
  created_at: string;
  title: string | null;
  default_model: string | null;
};

export type CollabDocument = {
  id: string;
  chat_id: string;
  title: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
};

export type CollabMessageRole = "user" | "assistant" | "system";

export type CollabMessageUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

/** Optional fields for user messages (attached context); extra keys allowed. */
export type CollabMessageMetadata = {
  context_document_ids?: string[];
  context_excerpt?: string;
  estimated_cost_usd?: number;
  /** Human-only chat line (no AI call). */
  note_only?: boolean;
} & Record<string, unknown>;

export type CollabMessage = {
  id: string;
  chat_id: string;
  role: CollabMessageRole;
  content: string | null;
  created_at: string;
  model: string | null;
  usage: CollabMessageUsage | null;
  metadata: CollabMessageMetadata;
  sort_key: number | null;
};

/** List row: document with embedded chat from PostgREST. */
export type CollabDocumentListRow = CollabDocument & {
  chats: CollabChat | null;
};
