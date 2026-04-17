import { roughTokenEstimate } from "@/lib/collab-ai-estimate";
import { chunkDocumentForAi } from "@/lib/collab-doc-chunking";
import {
  loadDocumentChunks,
  rebuildDocumentChunks,
} from "@/lib/collab-doc-chunk-store";
import {
  composeContextBlocks,
  retrieveChunksForPrompt,
} from "@/lib/collab-doc-retrieval";
import { getDocsSupabaseServiceClient } from "@/lib/docs-supabase";
import type { AgentIntent, AgentSource } from "@/lib/agent-graph/state";
import type { CollabDocumentChunk } from "@/types/collab-docs";

const TIER_A_MAX_TOKENS = 5_000;
const TIER_B_MAX_TOKENS = 16_000;

type RetrievedLike = {
  chunk: CollabDocumentChunk;
  score: number;
  reason: string;
};

type ContextNodeInput = {
  chatId: string;
  intent: AgentIntent;
  document: {
    id: string;
    title: string | null;
    content: string | null;
  };
  userRequest: string;
  contextDocumentIds: string[];
  maxContextDocs: number;
  retrievalMaxInputTokens: number;
  maxContextCharsPerDoc: number;
};

type ContextNodeOutput = {
  tier: "A_full_doc" | "B_section" | "C_chunk_store";
  contextBlocks: string;
  currentDocChunks: CollabDocumentChunk[];
  editableChunks: CollabDocumentChunk[];
  selectedSources: AgentSource[];
  usedInputTokens: number;
};

function ensureContextCoverage(params: {
  selected: RetrievedLike[];
  contextDocIds: string[];
  allChunks: CollabDocumentChunk[];
}): RetrievedLike[] {
  const out = [...params.selected];
  const seen = new Set(out.map((s) => `${s.chunk.document_id}:${s.chunk.chunk_index}`));
  for (const docId of params.contextDocIds) {
    const alreadyForDoc = out.filter((s) => s.chunk.document_id === docId).length;
    if (alreadyForDoc >= 2) continue;
    const candidates = params.allChunks
      .filter((c) => c.document_id === docId)
      .sort((a, b) => a.chunk_index - b.chunk_index)
      .slice(0, 4);
    for (const c of candidates) {
      if (out.filter((s) => s.chunk.document_id === docId).length >= 2) break;
      const key = `${c.document_id}:${c.chunk_index}`;
      if (seen.has(key)) continue;
      out.push({ chunk: c, score: 0, reason: "context-coverage" });
      seen.add(key);
    }
  }
  return out;
}

function asChunkRows(documentId: string, content: string): CollabDocumentChunk[] {
  const built = chunkDocumentForAi(content);
  if (built.length === 0) {
    return [
      {
        id: `${documentId}-synthetic-0`,
        document_id: documentId,
        chunk_index: 0,
        section_path: null,
        content,
        token_estimate: roughTokenEstimate(content),
        char_start: 0,
        char_end: content.length,
        content_hash: "synthetic-empty",
        keywords: [],
        embedding: null,
        created_at: "",
        updated_at: "",
      },
    ];
  }
  return built.map((c) => ({
    id: `${documentId}-local-${c.chunk_index}`,
    document_id: documentId,
    chunk_index: c.chunk_index,
    section_path: c.section_path,
    content: c.content,
    token_estimate: c.token_estimate,
    char_start: c.char_start,
    char_end: c.char_end,
    content_hash: c.content_hash,
    keywords: c.keywords,
    embedding: null,
    created_at: "",
    updated_at: "",
  }));
}

export async function runContextNode(input: ContextNodeInput): Promise<ContextNodeOutput> {
  const supabase = getDocsSupabaseServiceClient();
  const ctxIds = input.contextDocumentIds.filter((id) => id !== input.document.id);
  const slice = ctxIds.slice(0, input.maxContextDocs);
  const query = [input.userRequest, input.document.title ?? ""].join("\n");
  const docContent = input.document.content ?? "";
  const docTokens = roughTokenEstimate(docContent);

  const editableLimit = input.intent === "multi_doc_summary" ? 20 : 10;

  if (docTokens <= TIER_A_MAX_TOKENS && slice.length === 0) {
    const currentDocChunks = asChunkRows(input.document.id, docContent);
    const editableChunks = currentDocChunks.slice(
      0,
      Math.min(editableLimit, currentDocChunks.length)
    );
    return {
      tier: "A_full_doc",
      contextBlocks: "",
      currentDocChunks,
      editableChunks,
      selectedSources: editableChunks.map((c) => ({
        document_id: c.document_id,
        chunk_index: c.chunk_index,
        section_path: c.section_path,
        reason: "full-doc",
      })),
      usedInputTokens: docTokens,
    };
  }

  if (docTokens <= TIER_B_MAX_TOKENS) {
    const chunks: CollabDocumentChunk[] = asChunkRows(input.document.id, docContent);
    if (slice.length > 0) {
      const { data: ctxDocs } = await supabase
        .from("documents")
        .select("id, content")
        .in("id", slice);
      for (const d of ctxDocs ?? []) {
        chunks.push(...asChunkRows(d.id as string, (d.content as string | null) ?? ""));
      }
    }
    const retrieved = retrieveChunksForPrompt({
      query,
      chunks,
      maxInputTokens: input.retrievalMaxInputTokens,
      alwaysIncludeDocumentId: input.document.id,
      maxChunks: 20,
    });
    const selectedWithCoverage = ensureContextCoverage({
      selected: retrieved.selected,
      contextDocIds: slice,
      allChunks: chunks,
    });
    const contextBlocks = composeContextBlocks(
      selectedWithCoverage.filter((s) => s.chunk.document_id !== input.document.id)
    );
    const currentDocChunks = chunks
      .filter((c) => c.document_id === input.document.id)
      .sort((a, b) => a.chunk_index - b.chunk_index);
    let editableChunks = selectedWithCoverage
      .map((s) => s.chunk)
      .filter((c) => c.document_id === input.document.id)
      .slice(0, editableLimit)
      .sort((a, b) => a.chunk_index - b.chunk_index);
    if (editableChunks.length === 0) {
      editableChunks = currentDocChunks.slice(
        0,
        Math.min(editableLimit, currentDocChunks.length)
      );
    }
    return {
      tier: "B_section",
      contextBlocks,
      currentDocChunks,
      editableChunks,
      selectedSources: selectedWithCoverage.map((s) => ({
        document_id: s.chunk.document_id,
        chunk_index: s.chunk.chunk_index,
        section_path: s.chunk.section_path,
        reason: s.reason,
      })),
      usedInputTokens: retrieved.usedTokens,
    };
  }

  let contextBlocks = "";
  let currentDocChunks: CollabDocumentChunk[] = [];
  let editableChunks: CollabDocumentChunk[] = [];
  let selectedSources: AgentSource[] = [];
  let usedInputTokens = 0;

  const retrievalDocIds = [input.document.id, ...slice];
  try {
    let chunks = await loadDocumentChunks(retrievalDocIds);
    const chunkedDocSet = new Set(chunks.map((c) => c.document_id));
    const missingDocIds = retrievalDocIds.filter((id) => !chunkedDocSet.has(id));
    if (missingDocIds.length > 0) {
      const { data: missingDocs } = await supabase
        .from("documents")
        .select("id, content")
        .in("id", missingDocIds);
      for (const d of missingDocs ?? []) {
        const built = chunkDocumentForAi((d.content as string | null) ?? "");
        await rebuildDocumentChunks(d.id as string, built);
      }
      chunks = await loadDocumentChunks(retrievalDocIds);
    }

    const retrieved = retrieveChunksForPrompt({
      query,
      chunks,
      maxInputTokens: input.retrievalMaxInputTokens,
      alwaysIncludeDocumentId: input.document.id,
      maxChunks: 20,
    });
    const selectedWithCoverage = ensureContextCoverage({
      selected: retrieved.selected,
      contextDocIds: slice,
      allChunks: chunks,
    });
    contextBlocks = composeContextBlocks(
      selectedWithCoverage.filter((s) => s.chunk.document_id !== input.document.id)
    );
    currentDocChunks = chunks
      .filter((c) => c.document_id === input.document.id)
      .sort((a, b) => a.chunk_index - b.chunk_index);
    editableChunks = selectedWithCoverage
      .map((s) => s.chunk)
      .filter((c) => c.document_id === input.document.id);
    if (editableChunks.length === 0) {
      editableChunks = currentDocChunks.slice(
        0,
        Math.min(editableLimit, currentDocChunks.length)
      );
    } else {
      editableChunks = editableChunks
        .slice(0, Math.min(editableLimit, editableChunks.length))
        .sort((a, b) => a.chunk_index - b.chunk_index);
    }
    selectedSources = selectedWithCoverage.map((s) => ({
      document_id: s.chunk.document_id,
      chunk_index: s.chunk.chunk_index,
      section_path: s.chunk.section_path,
      reason: s.reason,
    }));
    usedInputTokens = retrieved.usedTokens;
  } catch (retrievalError) {
    console.error("collab-docs retrieval fallback:", retrievalError);
    if (slice.length > 0) {
      const { data: ctxDocs, error: ctxErr } = await supabase
        .from("documents")
        .select("id, title, content")
        .in("id", slice);
      if (!ctxErr && ctxDocs?.length) {
        contextBlocks = ctxDocs
          .map(
            (d) =>
              `### ${d.title || "Untitled"} (${d.id})\n${((d.content as string | null) ?? "").slice(0, input.maxContextCharsPerDoc)}`
          )
          .join("\n\n");
      }
    }
    if (currentDocChunks.length === 0) {
      const built = chunkDocumentForAi(input.document.content ?? "");
      await rebuildDocumentChunks(input.document.id, built);
      currentDocChunks = await loadDocumentChunks([input.document.id]);
    }
    if (editableChunks.length === 0) {
      editableChunks = currentDocChunks.slice(
        0,
        Math.min(editableLimit, currentDocChunks.length)
      );
    }
  }

  return {
    tier: "C_chunk_store",
    contextBlocks,
    currentDocChunks,
    editableChunks,
    selectedSources,
    usedInputTokens,
  };
}
