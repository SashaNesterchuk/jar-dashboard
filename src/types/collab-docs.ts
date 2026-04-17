/** Row shapes for collaborative doc editor (Supabase project docs). */

export type CollabChat = {
  id: string;
  created_at: string;
  title: string | null;
  default_model: string | null;
  document_id?: string | null;
};

export type CollabDocument = {
  id: string;
  /** Default chat to open from the documents list (optional). */
  primary_chat_id: string | null;
  folder_id: string | null;
  title: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
};

export type CollabDocumentFolder = {
  id: string;
  name: string;
  parent_id: string | null;
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

export type CollabAiCandidateStatus =
  | "pending"
  | "applied"
  | "rejected"
  | "superseded";

export type CollabAiChangeCandidate = {
  id: string;
  chat_id: string;
  document_id: string;
  base_document_content: string;
  candidate_document_content: string;
  model: string;
  chat_reply: string;
  status: CollabAiCandidateStatus;
  usage: CollabMessageUsage | null;
  latency_ms: number | null;
  created_at: string;
  applied_at: string | null;
  applied_by: string | null;
};

export type CollabDocumentChunk = {
  id: string;
  document_id: string;
  chunk_index: number;
  section_path: string | null;
  content: string;
  token_estimate: number;
  char_start: number;
  char_end: number;
  content_hash: string;
  keywords: string[];
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
};

export type CollabChunkBuild = {
  chunk_index: number;
  section_path: string | null;
  content: string;
  token_estimate: number;
  char_start: number;
  char_end: number;
  content_hash: string;
  keywords: string[];
};
