import { roughTokenEstimate } from "@/lib/collab-ai-estimate";
import type { CollabChunkBuild } from "@/types/collab-docs";

const DEFAULT_TARGET_TOKENS = 1100;
const DEFAULT_MAX_TOKENS = 1500;
const DEFAULT_OVERLAP_TOKENS = 140;

function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function extractKeywords(text: string, limit = 18): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

type Section = {
  headingPath: string | null;
  text: string;
  charStart: number;
};

function splitIntoSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentHeading: string | null = null;
  let buffer: string[] = [];
  let charPos = 0;
  let sectionStart = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    sections.push({
      headingPath: currentHeading,
      text: buffer.join("\n").trim(),
      charStart: sectionStart,
    });
    buffer = [];
  };

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      currentHeading = `${heading[1]} ${heading[2].trim()}`;
      sectionStart = charPos;
      buffer.push(line);
    } else {
      if (buffer.length === 0) sectionStart = charPos;
      buffer.push(line);
    }
    charPos += line.length + 1;
  }
  flush();
  return sections.filter((s) => s.text.length > 0);
}

export function chunkDocumentForAi(
  markdown: string,
  options?: {
    targetTokens?: number;
    maxTokens?: number;
    overlapTokens?: number;
  }
): CollabChunkBuild[] {
  const targetTokens = options?.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlapTokens = options?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const sections = splitIntoSections(markdown);
  if (sections.length === 0) return [];

  const chunks: CollabChunkBuild[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const paragraphs = section.text.split(/\n{2,}/g);
    let cursor = 0;
    while (cursor < paragraphs.length) {
      let taken: string[] = [];
      let takenTokens = 0;
      let consumed = 0;

      for (let i = cursor; i < paragraphs.length; i += 1) {
        const candidate = taken.length === 0 ? paragraphs[i] : `${taken.join("\n\n")}\n\n${paragraphs[i]}`;
        const t = roughTokenEstimate(candidate);
        if (t > maxTokens && taken.length > 0) break;
        taken = candidate.split(/\n{2,}/g);
        takenTokens = t;
        consumed += 1;
        if (t >= targetTokens) break;
      }

      const content = taken.join("\n\n").trim();
      const charStart = section.charStart + section.text.indexOf(content);
      const charEnd = charStart + content.length;
      chunks.push({
        chunk_index: chunkIndex,
        section_path: section.headingPath,
        content,
        token_estimate: takenTokens,
        char_start: Math.max(0, charStart),
        char_end: Math.max(charEnd, charStart),
        content_hash: stableHash(content),
        keywords: extractKeywords(content),
      });
      chunkIndex += 1;

      if (consumed <= 0) break;
      cursor += consumed;
      if (cursor < paragraphs.length && overlapTokens > 0) {
        let back = 0;
        let overlap = 0;
        while (cursor - back - 1 >= 0 && overlap < overlapTokens) {
          overlap += roughTokenEstimate(paragraphs[cursor - back - 1]);
          back += 1;
        }
        cursor = Math.max(0, cursor - Math.max(0, back - 1));
      }
    }
  }

  return chunks;
}
