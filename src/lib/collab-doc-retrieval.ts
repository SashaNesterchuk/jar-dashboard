import { roughTokenEstimate } from "@/lib/collab-ai-estimate";
import type { CollabDocumentChunk } from "@/types/collab-docs";

export type RetrievedChunk = {
  chunk: CollabDocumentChunk;
  score: number;
  reason: string;
};

type RetrieveParams = {
  query: string;
  chunks: CollabDocumentChunk[];
  maxInputTokens: number;
  reservedTokens?: number;
  alwaysIncludeDocumentId?: string | null;
  maxChunks?: number;
};

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function overlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  let overlap = 0;
  for (const w of a) if (bSet.has(w)) overlap += 1;
  return overlap / Math.max(1, Math.sqrt(a.length * b.length));
}

export function retrieveChunksForPrompt(params: RetrieveParams): {
  selected: RetrievedChunk[];
  usedTokens: number;
  budgetTokens: number;
} {
  const reserved = params.reservedTokens ?? 3500;
  const budgetTokens = Math.max(600, params.maxInputTokens - reserved);
  const queryWords = words(params.query);

  const ranked: RetrievedChunk[] = params.chunks.map((chunk) => {
    const chunkWords = chunk.keywords?.length ? chunk.keywords : words(chunk.content);
    const lexical = overlapScore(queryWords, chunkWords);
    const headingBoost =
      chunk.section_path && queryWords.some((w) => chunk.section_path!.toLowerCase().includes(w))
        ? 0.25
        : 0;
    const alwaysBoost =
      params.alwaysIncludeDocumentId && chunk.document_id === params.alwaysIncludeDocumentId
        ? 0.1
        : 0;
    const score = lexical + headingBoost + alwaysBoost;
    return {
      chunk,
      score,
      reason:
        headingBoost > 0
          ? "heading+lexical"
          : lexical > 0
            ? "lexical"
            : alwaysBoost > 0
              ? "current-doc"
              : "fallback",
    };
  });

  ranked.sort((a, b) => b.score - a.score || a.chunk.chunk_index - b.chunk.chunk_index);
  const selected: RetrievedChunk[] = [];
  let usedTokens = 0;
  const maxChunks = params.maxChunks ?? 12;

  for (const item of ranked) {
    if (selected.length >= maxChunks) break;
    const t = item.chunk.token_estimate || roughTokenEstimate(item.chunk.content);
    if (usedTokens + t > budgetTokens) continue;
    selected.push(item);
    usedTokens += t;
  }

  if (selected.length === 0 && ranked.length > 0) {
    const first = ranked[0];
    selected.push(first);
    usedTokens = first.chunk.token_estimate || roughTokenEstimate(first.chunk.content);
  }

  return { selected, usedTokens, budgetTokens };
}

export function composeContextBlocks(selected: RetrievedChunk[]): string {
  return selected
    .map(({ chunk, reason }) => {
      const head = chunk.section_path ? ` | ${chunk.section_path}` : "";
      return `### doc:${chunk.document_id} chunk:${chunk.chunk_index}${head} (${reason})\n${chunk.content}`;
    })
    .join("\n\n");
}
