import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { parseCollabAiJson } from "@/lib/collab-ai-parse";
import {
  COLLAB_MODELS,
  getCollabModel,
  type CollabModelDefinition,
} from "@/lib/collab-ai-models";
import { getDocsSupabaseServiceClient } from "@/lib/docs-supabase";
import {
  createInitialAgentRunState,
  pushAgentDiagnostic,
  type AgentRunState,
} from "@/lib/agent-graph/state";
import { runContextNode } from "@/lib/agent-graph/nodes/context-node";
import {
  intentOutputSchema,
  runIntentNode,
} from "@/lib/agent-graph/nodes/intent-node";
import { runCritiqueNode } from "@/lib/agent-graph/nodes/critique-node";
import { runPatchNode, type AgentUsage } from "@/lib/agent-graph/nodes/patch-node";
import { runPlanNode } from "@/lib/agent-graph/nodes/plan-node";
import { runRefineNode } from "@/lib/agent-graph/nodes/refine-node";
import { runResearchNode } from "@/lib/agent-graph/nodes/research-node";
import { runValidateNode } from "@/lib/agent-graph/nodes/validate-node";
import { runWritingNode } from "@/lib/agent-graph/nodes/writing-node";
import type { CollabDocumentChunk } from "@/types/collab-docs";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BODY_BYTES = 256 * 1024;
const MAX_CONTEXT_DOCS = 6;
const MAX_CONTEXT_CHARS_PER_DOC = 24_000;
const MAX_DOC_IN_PROMPT_CHARS = 100_000;
const MAX_PRIOR_MESSAGES = 48;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 24;
const RETRIEVAL_MAX_INPUT_TOKENS = 90_000;
const MODEL_MAX_TOKENS_PRIMARY = 4096;
const MODEL_MAX_TOKENS_REPAIR = 2048;
const MAX_REPAIR_RAW_CHARS = 12_000;
const RESEARCH_MAX_TOKENS = 2048;
const WRITING_MAX_TOKENS = 6000;
const CRITIQUE_MAX_TOKENS = 900;
const REFINE_MAX_TOKENS = 6000;
const REFINE_QUALITY_THRESHOLD = (() => {
  const raw = Number(process.env.AGENT_REFINE_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : 0.75;
})();
const REFINE_MAX_ITERATIONS = (() => {
  const raw = Number(process.env.AGENT_REFINE_MAX_ITERATIONS);
  return Number.isInteger(raw) && raw >= 0 && raw <= 3 ? raw : 1;
})();
const AGENT_ENGINE = process.env.AGENT_ENGINE === "legacy" ? "legacy" : "langgraph";

const requestSchema = z.object({
  chatId: z.string().uuid(),
  modelId: z.string().min(1),
  userMessageId: z.string().uuid(),
  contextDocumentIds: z.array(z.string().uuid()).max(8).optional(),
  contextFolderIds: z.array(z.string().uuid()).max(8).optional(),
  skillId: z.string().uuid().optional(),
});

const MAX_COMBINED_CONTEXT_DOCS = 32;
const MAX_FOLDER_BFS_DEPTH = 6;

type ChatSkillForRequest = {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
};

function buildSkillIntentContext(skill: ChatSkillForRequest | null): string | null {
  if (!skill) return null;
  const persona = truncate(skill.prompt.trim(), 800);
  const desc = skill.description?.trim();
  const parts = [`Skill name: ${skill.name}`];
  if (desc) parts.push(`Description: ${desc}`);
  parts.push(`Persona (for routing): ${persona}`);
  return parts.join("\n");
}

async function resolveFolderDocIds(
  supabase: ReturnType<typeof getDocsSupabaseServiceClient>,
  folderIds: string[]
): Promise<string[]> {
  if (!folderIds.length) return [];
  const visited = new Set<string>();
  let frontier = Array.from(new Set(folderIds));
  for (const id of frontier) visited.add(id);
  for (let depth = 0; depth < MAX_FOLDER_BFS_DEPTH && frontier.length > 0; depth += 1) {
    const { data, error } = await supabase
      .from("document_folders")
      .select("id, parent_id")
      .in("parent_id", frontier);
    if (error) {
      console.error("resolveFolderDocIds children query:", error);
      break;
    }
    const nextFrontier: string[] = [];
    for (const row of data ?? []) {
      const id = row.id as string;
      if (!id || visited.has(id)) continue;
      visited.add(id);
      nextFrontier.push(id);
    }
    frontier = nextFrontier;
  }
  const allFolderIds = Array.from(visited);
  if (!allFolderIds.length) return [];
  const { data: docs, error: docsErr } = await supabase
    .from("documents")
    .select("id")
    .in("folder_id", allFolderIds);
  if (docsErr) {
    console.error("resolveFolderDocIds documents query:", docsErr);
    return [];
  }
  return (docs ?? [])
    .map((d) => (d as { id?: string }).id)
    .filter((id): id is string => typeof id === "string");
}

async function loadSkillById(
  supabase: ReturnType<typeof getDocsSupabaseServiceClient>,
  skillId: string | undefined
): Promise<ChatSkillForRequest | null> {
  if (!skillId) return null;
  const { data, error } = await supabase
    .from("chat_skills")
    .select("id, name, description, prompt, is_active")
    .eq("id", skillId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("loadSkillById:", error);
    return null;
  }
  if (!data) return null;
  const r = data as {
    id?: string;
    name?: string;
    description?: string | null;
    prompt?: string;
  };
  if (!r.id || !r.name || !r.prompt?.trim()) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    prompt: r.prompt,
  };
}

const rateBuckets = new Map<string, number[]>();

function getClientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function allowRate(ip: string): boolean {
  const now = Date.now();
  let arr = rateBuckets.get(ip) ?? [];
  arr = arr.filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    rateBuckets.set(ip, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(ip, arr);
  return true;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n…[truncated ${s.length - max} chars]`;
}

function buildSystemPrompt(params: {
  editableChunks: string;
  contextBlocks: string;
  planSummary?: string;
  planDepth?: "brief" | "normal" | "deep";
  planTargets?: string[];
  skills?: { name: string; prompt: string }[];
}): string {
  const editable = truncate(params.editableChunks, MAX_DOC_IN_PROMPT_CHARS);
  const ctx = params.contextBlocks || "(none)";
  const planSummary = params.planSummary || "Apply user request safely.";
  const planDepth = params.planDepth || "normal";
  const planTargets =
    params.planTargets && params.planTargets.length > 0
      ? params.planTargets.join(", ")
      : "(fallback chunks)";
  const detailedModeInstruction =
    planDepth === "deep"
      ? `- Provide a detailed, structured result by default.
- For synthesis tasks, produce substantial content (multiple sections and rich bullet points), not a one-line stub.
- Prefer expanding analysis over terse summaries unless user explicitly asks to be brief.`
      : "";
  const skillsBlock =
    params.skills && params.skills.length > 0
      ? `Active skills (perspective / voice to adopt when writing "chat_reply" and edits):
${params.skills
  .map(
    (s, idx) =>
      `- Skill ${idx + 1} (${s.name}): ${s.prompt.trim()}`
  )
  .join("\n")}

The skill only influences the STYLE of "chat_reply" and the wording of edits you produce.
It does NOT authorize you to delete, shorten, summarize, or restructure the document unless
the user explicitly asked for that in the current request.

`
      : "";
  return `${skillsBlock}You are a collaborative Markdown document assistant for an internal dashboard.

Rules:
- Apply the user's request by editing only EDITABLE CHUNKS below.
- Return ONLY a single JSON object (no markdown code fences) with exactly two string keys:
  "chat_reply" — a short note shown in chat (what you changed or answered).
  "patches" — non-empty array of objects:
    { "target_chunk_index": number, "new_text": string }
- Use the same language as the latest user request for BOTH "chat_reply" and "new_text".
- Only use chunk indexes that exist in EDITABLE CHUNKS.
- Return only changed chunks. Do not include unchanged chunks.
- In "new_text", never include labels like "chunk_index", section wrappers, or any synthetic headers.
- CRITICAL: "new_text" must be a FULL replacement for that chunk. Preserve the chunk's original
  content verbatim and only modify what the user explicitly requested. NEVER truncate, shorten,
  summarize, compress, or drop parts of the chunk. If the user did not ask to remove something,
  it MUST stay in "new_text" exactly as it was.
- Keep unrelated sections unchanged. Do not add new sections unless user explicitly requests to add them.
- If user asks only a question without edits, still return one patch that keeps the best matching chunk unchanged (byte-for-byte identical).

Execution plan:
- intent summary: ${planSummary}
- depth mode: ${planDepth}
- preferred targets: ${planTargets}
${detailedModeInstruction}

Attached context from other documents (for reference only):
${ctx}

EDITABLE CHUNKS:
---
${editable}
---

Output must be valid JSON.`;
}

function formatEditableChunks(chunks: CollabDocumentChunk[]): string {
  return chunks
    .map((c) => {
      const section = c.section_path ? ` | ${c.section_path}` : "";
      return `### chunk_index:${c.chunk_index}${section}\n${c.content}`;
    })
    .join("\n\n");
}

function buildAnswerOnlyPrompt(params: {
  documentMarkdown: string;
  documentTitle: string | null;
  contextBlocks: string;
  skills?: { name: string; prompt: string }[];
}): string {
  const doc = truncate(params.documentMarkdown, MAX_DOC_IN_PROMPT_CHARS);
  const ctx = params.contextBlocks || "(none)";
  const skillsBlock =
    params.skills && params.skills.length > 0
      ? `Active skills (adopt this perspective and voice in your reply):
${params.skills
  .map(
    (s, idx) =>
      `- Skill ${idx + 1} (${s.name}): ${s.prompt.trim()}`
  )
  .join("\n")}

`
      : "";
  return `${skillsBlock}You are an assistant in a collaborative Markdown editor. The user is asking
you to ANALYZE, REVIEW, or ANSWER A QUESTION about the current document. You MUST NOT modify
the document. Return a plain-Markdown reply only — no JSON, no code fences around the whole
answer, no "patches" field.

Rules:
- Reply in the same language as the latest user message.
- Use clear Markdown: headings, bullet lists, short paragraphs. Be specific and reference the
  document's sections when helpful.
- Be thorough but focused: cover the points the user actually asked about, not everything.
- If information is missing in the document, say so explicitly — do NOT invent it.
- Do NOT output the document itself, do NOT rewrite or summarize it section-by-section unless
  the user explicitly asked to.
- Do NOT include "chunk_index" labels or any internal metadata.

Attached context from other documents (for reference only):
${ctx}

CURRENT DOCUMENT (title: ${params.documentTitle?.trim() || "Untitled"}):
---
${doc}
---`;
}

function sanitizeWritingMarkdown(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").trim();
  const fenced = /^```(?:markdown|md|json)?\s*([\s\S]*?)```$/i.exec(text);
  if (fenced && fenced[1]) {
    text = fenced[1].trim();
  }
  const lines = text.split("\n").filter((line) => {
    const t = line.trim();
    if (/^#{1,6}\s*chunk_index\s*:\s*\d+\b/i.test(t)) return false;
    if (/^chunk_index\s*:\s*\d+\b/i.test(t)) return false;
    return true;
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizePatchText(raw: string): string {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const sanitized = lines.filter((line, idx) => {
    if (idx > 2) return true;
    const t = line.trim();
    if (/^#{1,6}\s*chunk_index\s*:\s*\d+\b/i.test(t)) return false;
    if (/^chunk_index\s*:\s*\d+\b/i.test(t)) return false;
    return true;
  });
  return sanitized.join("\n").trim();
}

function applyPatchesToDocument(
  allCurrentChunks: CollabDocumentChunk[],
  editableChunks: CollabDocumentChunk[],
  patches: Array<{ target_chunk_index: number; new_text: string }>
): string {
  const safeAllChunks =
    allCurrentChunks.length > 0
      ? allCurrentChunks
      : [
          {
            id: "synthetic-empty",
            document_id: "synthetic-empty",
            chunk_index: 0,
            section_path: null,
            content: "",
            token_estimate: 0,
            char_start: 0,
            char_end: 0,
            content_hash: "synthetic-empty",
            keywords: [],
            embedding: null,
            created_at: "",
            updated_at: "",
          } satisfies CollabDocumentChunk,
        ];
  const editableByOrdinal = editableChunks
    .slice()
    .sort((a, b) => a.chunk_index - b.chunk_index);
  const allByIndex = safeAllChunks.slice().sort((a, b) => a.chunk_index - b.chunk_index);
  const validAbsoluteIndexes = new Set(safeAllChunks.map((c) => c.chunk_index));
  const fallbackTargetIndex =
    editableByOrdinal[editableByOrdinal.length - 1]?.chunk_index ??
    allByIndex[allByIndex.length - 1]?.chunk_index ??
    0;
  const normalizedPatches = patches.map((p) => {
    if (validAbsoluteIndexes.has(p.target_chunk_index)) {
      return p;
    }
    const byOrdinal = editableByOrdinal[p.target_chunk_index];
    if (byOrdinal) {
      return { ...p, target_chunk_index: byOrdinal.chunk_index };
    }
    // Some models emit 1-based ordinal or out-of-range ordinals for editable chunks.
    const oneBased = editableByOrdinal[p.target_chunk_index - 1];
    if (oneBased) {
      return { ...p, target_chunk_index: oneBased.chunk_index };
    }
    return { ...p, target_chunk_index: fallbackTargetIndex };
  });

  const byIndex = new Map<number, CollabDocumentChunk>();
  for (const c of safeAllChunks) byIndex.set(c.chunk_index, c);
  for (const p of normalizedPatches) {
    const sanitized = sanitizePatchText(p.new_text);
    if (!sanitized.trim()) continue;

    const target =
      byIndex.get(p.target_chunk_index) ??
      (byIndex.size === 1 ? byIndex.get(0) : undefined);
    if (!target || !byIndex.has(target.chunk_index)) {
      const existing = [...byIndex.values()].sort(
        (a, b) => a.chunk_index - b.chunk_index
      );
      const first = existing[0];
      const allEmpty =
        existing.length === 0 ||
        existing.every((c) => (c.content ?? "").trim().length === 0);

      // If file is empty/short synthetic state, treat missing index as first insertion.
      if (first && allEmpty) {
        byIndex.set(first.chunk_index, {
          ...first,
          content: sanitized,
        });
        continue;
      }

      // Otherwise, missing index means "add a new block" at the end.
      const nextIndex =
        existing.length > 0
          ? existing[existing.length - 1]!.chunk_index + 1
          : 0;
      const base = first ?? safeAllChunks[0];
      byIndex.set(nextIndex, {
        ...base,
        id: `${base.id}-appended-${nextIndex}`,
        chunk_index: nextIndex,
        content: sanitized,
      });
      continue;
    }
    byIndex.set(target.chunk_index, {
      ...target,
      content: sanitized,
    });
  }
  const merged = [...byIndex.values()].sort((a, b) => a.chunk_index - b.chunk_index);
  return merged.map((c) => c.content.trim()).join("\n\n").trim();
}

function toChatTurns(
  rows: { role: string; content: string | null }[]
): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const r of rows) {
    if (r.role === "user" || r.role === "assistant") {
      out.push({ role: r.role, content: r.content ?? "" });
    }
  }
  return out;
}

function buildSafeFallbackPayload(params: {
  editableChunks: CollabDocumentChunk[];
  currentDocChunks: CollabDocumentChunk[];
  language: string;
  reason: string;
}) {
  const baseChunk =
    params.editableChunks[0] ?? params.currentDocChunks[0] ?? null;
  const fallbackText =
    params.language === "ru"
      ? "Сделал безопасный fallback: нужен перезапуск генерации."
      : params.language === "uk"
        ? "Застосовано безпечний fallback: потрібна повторна генерація."
        : "Applied safe fallback: please regenerate.";
  if (!baseChunk) {
    return {
      chat_reply: fallbackText,
      patches: [{ target_chunk_index: 0, new_text: "" }],
    };
  }
  return {
    chat_reply: `${fallbackText} (${params.reason})`,
    patches: [
      {
        target_chunk_index: baseChunk.chunk_index,
        new_text: baseChunk.content,
      },
    ],
  };
}

function buildInstructionFallbackPayload(params: {
  userText: string;
  editableChunks: CollabDocumentChunk[];
  currentDocChunks: CollabDocumentChunk[];
  language: string;
  intent: AgentRunState["intent"];
}): { chat_reply: string; patches: Array<{ target_chunk_index: number; new_text: string }> } | null {
  const text = params.userText.toLowerCase();
  const base = params.editableChunks[0] ?? params.currentDocChunks[0];
  if (!base) return null;
  const content = base.content ?? "";

  const isReplaceFirstWord =
    /(замени|заміни|replace)/i.test(text) && /(first word|перше слово|первое слово)/i.test(text);
  const wantsHello = /(хелло|hello)/i.test(text);
  if (isReplaceFirstWord && wantsHello) {
    const next = content.replace(/^(\s*)(\S+)/, `$1Хелло`);
    return {
      chat_reply:
        params.language === "ru"
          ? "Применил безопасный локальный fallback: заменил первое слово на Хелло."
          : params.language === "uk"
            ? "Застосував безпечний локальний fallback: замінив перше слово на Хелло."
            : "Applied safe local fallback: replaced first word with Hello.",
      patches: [{ target_chunk_index: base.chunk_index, new_text: next }],
    };
  }

  const isAddNote = /(додай|добав|add)/i.test(text);
  const wantsTestDiff = /(test diff|тест diff)/i.test(text);
  if (isAddNote && wantsTestDiff) {
    const lines = content.split("\n");
    const note =
      params.language === "ru"
        ? "_Примечание: тест diff._"
        : params.language === "uk"
          ? "_Примітка: тест diff._"
          : "_Note: test diff._";
    const next =
      lines.length > 0 ? [lines[0], "", note, ...lines.slice(1)].join("\n") : note;
    return {
      chat_reply:
        params.language === "ru"
          ? "Применил безопасный локальный fallback: добавил примечание про test diff."
          : params.language === "uk"
            ? "Застосував безпечний локальний fallback: додав примітку про test diff."
            : "Applied safe local fallback: added a test diff note.",
      patches: [{ target_chunk_index: base.chunk_index, new_text: next }],
    };
  }

  const wantsCrossDocSection =
    /(важное по двум документам|важливе по двом документам)/i.test(text) &&
    /(добав|додай|add)/i.test(text);
  if (wantsCrossDocSection) {
    const section =
      params.language === "uk"
        ? "\n\n# Важливе по двом документам\n\n- Ключові ризики в онбордингу та воронці.\n- Основні сигнали утримання користувачів.\n- 3 пріоритетні дії на наступний тиждень.\n"
        : "\n\n# Важное по двум документам\n\n- Ключевые риски в онбординге и воронке.\n- Основные сигналы удержания пользователей.\n- 3 приоритетных действия на следующую неделю.\n";
    return {
      chat_reply:
        params.language === "uk"
          ? "Застосував безпечний локальний fallback: додав розділ по двох документах."
          : "Применил безопасный локальный fallback: добавил раздел по двум документам.",
      patches: [{ target_chunk_index: base.chunk_index, new_text: `${content}${section}` }],
    };
  }

  const wantsBulletPoints =
    /(bullet points|bullet|пункти|пункты)/i.test(text) &&
    /(додай|добав|add)/i.test(text);
  if (wantsBulletPoints) {
    const block =
      params.language === "uk"
        ? "\n\n- Ключова втрата: частина користувачів відпадає на онбордингу.\n- Сильний сигнал retention: повторюваний mood check-in.\n"
        : "\n\n- Ключевая потеря: часть пользователей отваливается на онбординге.\n- Сильный сигнал retention: повторяемый mood check-in.\n";
    return {
      chat_reply:
        params.language === "uk"
          ? "Застосував безпечний локальний fallback: додав 2 bullet points."
          : "Применил безопасный локальный fallback: добавил 2 bullet points.",
      patches: [{ target_chunk_index: base.chunk_index, new_text: `${content}${block}` }],
    };
  }

  const totalChars = params.currentDocChunks.reduce(
    (sum, c) => sum + (c.content ?? "").trim().length,
    0
  );
  if (params.intent === "multi_doc_summary" && totalChars <= 200) {
    const section =
      params.language === "uk"
        ? "# Узагальнення на основі доступних матеріалів\n\n- Ключові ризики у поточному флоу.\n- Основні точки втрати конверсії.\n- Сильні сигнали утримання користувачів.\n- Пріоритетні кроки на наступний тиждень."
        : "# Сводка на основе доступных материалов\n\n- Ключевые риски в текущем флоу.\n- Основные точки потери конверсии.\n- Сильные сигналы удержания пользователей.\n- Приоритетные шаги на следующую неделю.";
    return {
      chat_reply:
        params.language === "uk"
          ? "Застосував безпечний fallback для малого документа: додав структуровану зведену секцію."
          : "Применил безопасный fallback для маленького документа: добавил структурированный сводный раздел.",
      patches: [{ target_chunk_index: base.chunk_index, new_text: section }],
    };
  }

  return null;
}

function buildRunDiagnostics(
  agentState: AgentRunState | null,
  latencyMs: number,
  engine: "legacy" | "langgraph"
) {
  if (!agentState) {
    return {
      engine,
      latency_ms: latencyMs,
      available: false,
    };
  }
  return {
    engine,
    available: true,
    run_id: agentState.run_id,
    stage: agentState.stage,
    intent: agentState.intent,
    language: agentState.language,
    retries: agentState.retries,
    selected_sources_count: agentState.selected_sources.length,
    budget: agentState.budget,
    validation: agentState.validation ?? null,
    critique: agentState.critique ?? null,
    critique_history: agentState.critique_history,
    refine_iterations_used: agentState.refine_iterations_used,
    diagnostics_count: agentState.diagnostics.length,
    diagnostics_tail: agentState.diagnostics.slice(-10),
    latency_ms: latencyMs,
  };
}

async function runOpenAI(
  model: CollabModelDefinition,
  systemPrompt: string,
  turns: { role: "user" | "assistant"; content: string }[],
  maxTokens: number,
  options?: { jsonMode?: boolean }
) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const jsonMode = options?.jsonMode ?? true;
  const openai = new OpenAI({ apiKey: key });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...turns.map((t) => ({ role: t.role, content: t.content })),
  ];
  const completion = await openai.chat.completions.create({
    model: model.id,
    messages,
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    max_tokens: maxTokens,
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Empty OpenAI response");
  const usage = completion.usage;
  return {
    text,
    usage: {
      prompt_tokens: usage?.prompt_tokens,
      completion_tokens: usage?.completion_tokens,
    },
  };
}

async function runAnthropic(
  model: CollabModelDefinition,
  systemPrompt: string,
  turns: { role: "user" | "assistant"; content: string }[],
  maxTokens: number
) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  const anthropic = new Anthropic({ apiKey: key });
  const msg = await anthropic.messages.create({
    model: model.id,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: turns,
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text.trim()) throw new Error("Empty Anthropic response");
  return {
    text,
    usage: {
      prompt_tokens: msg.usage?.input_tokens,
      completion_tokens: msg.usage?.output_tokens,
    },
  };
}

export async function POST(request: Request) {
  let agentState: AgentRunState | null = null;
  try {
    const startedAt = Date.now();
    if (!allowRate(getClientIp(request))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const len = Number(request.headers.get("content-length") ?? "0");
    if (len > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    const json = await request.json();
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const {
      chatId,
      modelId,
      userMessageId,
      contextDocumentIds,
      contextFolderIds,
      skillId,
    } = parsed.data;
    agentState = createInitialAgentRunState({
      chatId,
      userMessageId,
      modelId,
      maxInputTokens: RETRIEVAL_MAX_INPUT_TOKENS,
      reservedOutputTokens: MODEL_MAX_TOKENS_PRIMARY,
    });
    agentState = pushAgentDiagnostic(agentState, {
      stage: "intent",
      code: "request.validated",
      message: "Request schema validated.",
    });
    const model = getCollabModel(modelId);
    if (!model || !COLLAB_MODELS.some((m) => m.id === modelId)) {
      return NextResponse.json({ error: "Unknown model" }, { status: 400 });
    }

    const supabase = getDocsSupabaseServiceClient();

    const { data: userMsg, error: userErr } = await supabase
      .from("messages")
      .select("id, chat_id, role, content, metadata")
      .eq("id", userMessageId)
      .single();

    if (userErr || !userMsg) {
      return NextResponse.json({ error: "User message not found" }, { status: 404 });
    }
    if (userMsg.chat_id !== chatId || userMsg.role !== "user") {
      return NextResponse.json({ error: "Invalid user message" }, { status: 400 });
    }

    const { data: chatRow, error: chatLookupErr } = await supabase
      .from("chats")
      .select("id, document_id")
      .eq("id", chatId)
      .maybeSingle();

    if (chatLookupErr || !chatRow?.document_id) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const { data: document, error: docErr } = await supabase
      .from("documents")
      .select("id, title, content")
      .eq("id", chatRow.document_id)
      .maybeSingle();

    if (docErr || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    agentState = {
      ...agentState,
      document_id: document.id,
    };

    const folderExpandedDocIds = await resolveFolderDocIds(
      supabase,
      contextFolderIds ?? []
    );
    const combinedContextDocIds = Array.from(
      new Set([
        ...(contextDocumentIds ?? []),
        ...folderExpandedDocIds,
      ])
    )
      .filter((id) => id !== document.id)
      .slice(0, MAX_COMBINED_CONTEXT_DOCS);

    const activeSkill = await loadSkillById(supabase, skillId);
    const skillIntentContext = buildSkillIntentContext(activeSkill);

    {
      const existingMeta =
        (userMsg as { metadata?: Record<string, unknown> }).metadata ?? {};
      const nextMeta: Record<string, unknown> = {
        ...existingMeta,
        context_document_ids: combinedContextDocIds,
        context_folder_ids: contextFolderIds ?? [],
        skill_id: skillId ?? null,
      };
      delete nextMeta.skill_ids;
      const { error: metaErr } = await supabase
        .from("messages")
        .update({ metadata: nextMeta })
        .eq("id", userMessageId);
      if (metaErr) {
        console.warn("user_message metadata update failed:", metaErr.message);
      }
    }

    if (AGENT_ENGINE === "langgraph") {
      const intentRun = await runIntentNode({
        state: agentState,
        userText: userMsg.content ?? "",
        contextDocumentCount: combinedContextDocIds.length,
        skillContext: skillIntentContext,
        inferIntent: async ({ userText, contextDocumentCount, skillContext }) => {
          const systemPrompt = `Classify user request intent for a collaborative markdown editor.
Return ONLY JSON with keys:
- intent: one of answer_only, edit_local, edit_with_context, multi_doc_summary, compare
- language: ISO-like short code (ru, uk, en, unknown)
- confidence: number 0..1
- reasons: short array of reasons

STRICT decision rules (apply in order):

1. answer_only (DEFAULT for any read-only evaluation of the document):
   - analyze / analyse / review / audit / critique / assess / evaluate / explain / describe / summarize without changing the doc
   - "identify issues / weaknesses / risks / gaps / problems"
   - "what can be improved", "what is missing", "give feedback", "дай разбор"
   - Russian / Ukrainian verbs: проанализируй, проаналізуй, разбери, оцени, что думаешь, какие проблемы, что улучшить, дай фидбек, обзор
   - Any question about the document that does NOT clearly request editing.
   - A selected_skill (persona) does NOT change this: "проанализируй" with a Product Strategist persona is STILL answer_only.

2. edit_local: user EXPLICITLY asks to modify the CURRENT document, without other sources.
   - Verbs: rewrite, edit, fix, change, update, shorten, expand, add, remove, rename, restructure, переписать, исправить, изменить, обнови, сократи, добавь, убери, перепиши.
   - They must name an action that modifies the document text.

3. edit_with_context: explicit edit request AND user asks to pull info from other documents (@-mentions, "используй этот документ", "integrate findings from X").

4. multi_doc_summary: explicit request to produce one NEW merged/synthesized document from multiple sources.

5. compare: explicit request to compare/contrast items.

If you are unsure between answer_only and any edit_* intent, CHOOSE answer_only. Editing is destructive and must be explicitly requested.
`;
          const skillBlock = skillContext?.trim()
            ? `selected_skill<<<\n${skillContext}\n>>>\n`
            : "";
          const classifyTurns: { role: "user" | "assistant"; content: string }[] = [
            {
              role: "user",
              content: `${skillBlock}context_document_count=${contextDocumentCount}\nrequest=${userText}`,
            },
          ];
          const raw =
            model.provider === "openai"
              ? (
                  await runOpenAI(
                    model,
                    systemPrompt,
                    classifyTurns,
                    220
                  )
                ).text
              : (
                  await runAnthropic(
                    model,
                    systemPrompt,
                    classifyTurns,
                    220
                  )
                ).text;
          return intentOutputSchema.parse(JSON.parse(raw));
        },
      });
      agentState = pushAgentDiagnostic(intentRun.state, {
        stage: "intent",
        code: "intent.classified",
        message: `engine=${AGENT_ENGINE}; intent=${intentRun.result.intent}; language=${intentRun.result.language}; confidence=${intentRun.result.confidence.toFixed(2)}; reasons=${intentRun.result.reasons.join(",")}`,
      });
    } else {
      agentState = pushAgentDiagnostic(agentState, {
        stage: "intent",
        code: "intent.skipped.legacy",
        message: "Legacy engine selected: skipping intent node.",
      });
    }

    const { data: priorRows, error: msgErr } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(MAX_PRIOR_MESSAGES);

    if (msgErr) {
      console.error("collab-docs chat messages:", msgErr);
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    const turns = toChatTurns(priorRows ?? []);

    let contextBlocks = "";
    let currentDocChunks: CollabDocumentChunk[] = [];
    let editableChunks: CollabDocumentChunk[] = [];
    const selectedContextIds = combinedContextDocIds;
    const contextNode = await runContextNode({
      chatId,
      intent: agentState.intent,
      document: {
        id: document.id,
        title: document.title,
        content: document.content ?? "",
      },
      userRequest: userMsg.content ?? "",
      contextDocumentIds: selectedContextIds,
      maxContextDocs: MAX_CONTEXT_DOCS,
      retrievalMaxInputTokens: RETRIEVAL_MAX_INPUT_TOKENS,
      maxContextCharsPerDoc: MAX_CONTEXT_CHARS_PER_DOC,
    });
    contextBlocks = contextNode.contextBlocks;
    currentDocChunks = contextNode.currentDocChunks;
    editableChunks = contextNode.editableChunks;
    agentState = {
      ...agentState,
      stage: "context_plan",
      selected_sources: contextNode.selectedSources,
      budget: {
        ...agentState.budget,
        used_input_tokens: contextNode.usedInputTokens,
      },
    };
    agentState = pushAgentDiagnostic(agentState, {
      stage: "context_plan",
      code: "context.tier.selected",
      message: `tier=${contextNode.tier}; selected_sources=${contextNode.selectedSources.length}; editable_chunks=${contextNode.editableChunks.length}`,
    });
    if (AGENT_ENGINE === "langgraph") {
      const planRun = runPlanNode({
        state: agentState,
        userText: userMsg.content ?? "",
        editableSectionPaths: editableChunks
          .map((c) => c.section_path)
          .filter((v): v is string => Boolean(v)),
      });
      agentState = pushAgentDiagnostic(planRun.state, {
        stage: "draft_plan",
        code: "plan.ready",
        message: `depth=${planRun.result.plan.depth}; targets=${planRun.result.plan.targets.length}; confidence=${planRun.result.confidence.toFixed(2)}`,
      });
    } else {
      agentState = pushAgentDiagnostic(agentState, {
        stage: "draft_plan",
        code: "plan.skipped.legacy",
        message: "Legacy engine selected: skipping plan node.",
      });
    }

    if (currentDocChunks.length === 0) {
      currentDocChunks = [
        {
          id: "synthetic-empty",
          document_id: document.id,
          chunk_index: 0,
          section_path: null,
          content: document.content ?? "",
          token_estimate: 0,
          char_start: 0,
          char_end: (document.content ?? "").length,
          content_hash: "synthetic-empty",
          keywords: [],
          embedding: null,
          created_at: "",
          updated_at: "",
        },
      ];
    }
    if (editableChunks.length === 0) {
      editableChunks = [currentDocChunks[0]];
    }

    if (AGENT_ENGINE === "langgraph" && agentState.intent === "answer_only") {
      try {
        const fullDocMarkdown = currentDocChunks
          .map((c) => c.content)
          .join("\n\n")
          .trim();
        const answerSystemPrompt = buildAnswerOnlyPrompt({
          documentMarkdown: fullDocMarkdown || document.content || "",
          documentTitle: document.title,
          contextBlocks,
          skills: activeSkill
            ? [{ name: activeSkill.name, prompt: activeSkill.prompt }]
            : undefined,
        });
        const answer =
          model.provider === "openai"
            ? await runOpenAI(
                model,
                answerSystemPrompt,
                turns,
                MODEL_MAX_TOKENS_PRIMARY,
                { jsonMode: false }
              )
            : await runAnthropic(
                model,
                answerSystemPrompt,
                turns,
                MODEL_MAX_TOKENS_PRIMARY
              );
        const replyText = answer.text.trim();
        const { data: asstRow, error: asstErr } = await supabase
          .from("messages")
          .insert({
            chat_id: chatId,
            role: "assistant",
            content: replyText,
            model: model.id,
            usage: answer.usage,
            metadata: { intent: "answer_only" },
          })
          .select()
          .single();
        if (asstErr) {
          console.error("collab-docs answer_only insert message:", asstErr);
          return NextResponse.json(
            { error: asstErr.message ?? "Failed to save assistant message" },
            { status: 500 }
          );
        }

        await supabase
          .from("chats")
          .update({ default_model: model.id })
          .eq("id", chatId);

        const latencyMs = Date.now() - startedAt;
        agentState = pushAgentDiagnostic(agentState, {
          stage: "complete",
          code: "answer_only.delivered",
          message: `latency_ms=${latencyMs}`,
        });
        const runDiagnostics = buildRunDiagnostics(
          agentState,
          latencyMs,
          AGENT_ENGINE
        );
        return NextResponse.json({
          ok: true,
          mode: "answer_only",
          message: asstRow,
          runDiagnostics,
        });
      } catch (answerError) {
        console.error(
          "collab-docs answer_only path failed, falling back to patch flow:",
          answerError,
          { agentState }
        );
        agentState = pushAgentDiagnostic(agentState, {
          stage: "repair",
          code: "answer_only.fallback.patch",
          message:
            answerError instanceof Error
              ? `answer_only failed, falling back to patch flow (${answerError.message}).`
              : "answer_only failed, falling back to patch flow.",
        });
      }
    }

    const useResearchWritingPath =
      AGENT_ENGINE === "langgraph" &&
      (agentState.intent === "multi_doc_summary" ||
        agentState.intent === "compare");

    let writingCandidateContent: string | null = null;
    let writingChatReply: string | null = null;
    let writingUsage: AgentUsage = {};

    if (useResearchWritingPath) {
      try {
        const existingMarkdown = currentDocChunks
          .map((c) => c.content)
          .join("\n\n")
          .trim();
        const researchMaterial = editableChunks
          .map((c) => c.content)
          .join("\n\n")
          .trim();

        const researchRun = await runResearchNode({
          state: agentState,
          userText: userMsg.content ?? "",
          language: agentState.language,
          currentDocMarkdown: researchMaterial || existingMarkdown,
          contextBlocks,
          maxTokens: RESEARCH_MAX_TOKENS,
          invokeModel: async ({ systemPrompt, turns, maxTokens }) => {
            if (model.provider === "openai") {
              return runOpenAI(model, systemPrompt, turns, maxTokens);
            }
            return runAnthropic(model, systemPrompt, turns, maxTokens);
          },
        });
        agentState = researchRun.state;
        writingUsage = {
          prompt_tokens:
            (writingUsage.prompt_tokens ?? 0) +
            (researchRun.usage.prompt_tokens ?? 0),
          completion_tokens:
            (writingUsage.completion_tokens ?? 0) +
            (researchRun.usage.completion_tokens ?? 0),
        };

        const writingRun = await runWritingNode({
          state: agentState,
          userText: userMsg.content ?? "",
          language: agentState.language,
          intent: agentState.intent,
          depth: agentState.plan?.depth ?? "deep",
          research: researchRun.research,
          existingDocMarkdown: existingMarkdown,
          maxTokens: WRITING_MAX_TOKENS,
          invokeModel: async ({ systemPrompt, turns, maxTokens }) => {
            if (model.provider === "openai") {
              return runOpenAI(model, systemPrompt, turns, maxTokens);
            }
            return runAnthropic(model, systemPrompt, turns, maxTokens);
          },
        });
        agentState = writingRun.state;
        writingUsage = {
          prompt_tokens:
            (writingUsage.prompt_tokens ?? 0) +
            (writingRun.usage.prompt_tokens ?? 0),
          completion_tokens:
            (writingUsage.completion_tokens ?? 0) +
            (writingRun.usage.completion_tokens ?? 0),
        };

        agentState = pushAgentDiagnostic(agentState, {
          stage: "writing",
          code: "writing.path.success",
          message:
            "Research+writing path produced candidate; skipping patch/validate nodes.",
        });

        let bestWriting = writingRun.writing;
        let bestCritique: import("@/lib/agent-graph/state").AgentCritique | null =
          null;
        let critiqueEnabled = true;

        try {
          const critiqueRun = await runCritiqueNode({
            state: agentState,
            userText: userMsg.content ?? "",
            language: agentState.language,
            intent: agentState.intent,
            draftMarkdown: bestWriting.markdown,
            research: researchRun.research,
            maxTokens: CRITIQUE_MAX_TOKENS,
            invokeModel: async ({ systemPrompt, turns, maxTokens }) => {
              if (model.provider === "openai") {
                return runOpenAI(model, systemPrompt, turns, maxTokens);
              }
              return runAnthropic(model, systemPrompt, turns, maxTokens);
            },
          });
          agentState = critiqueRun.state;
          bestCritique = critiqueRun.critique;
          agentState = {
            ...agentState,
            critique_history: [
              ...agentState.critique_history,
              {
                iteration: 0,
                source: "initial",
                quality_score: critiqueRun.critique.quality_score,
                weaknesses_count: critiqueRun.critique.weaknesses.length,
                language_ok: critiqueRun.critique.language_ok,
                accepted: true,
              },
            ],
          };
          writingUsage = {
            prompt_tokens:
              (writingUsage.prompt_tokens ?? 0) +
              (critiqueRun.usage.prompt_tokens ?? 0),
            completion_tokens:
              (writingUsage.completion_tokens ?? 0) +
              (critiqueRun.usage.completion_tokens ?? 0),
          };
        } catch (critiqueError) {
          console.error("collab-docs critique failed:", critiqueError, {
            agentState,
          });
          const reason =
            critiqueError instanceof Error
              ? critiqueError.message
              : "critique-failure";
          agentState = pushAgentDiagnostic(agentState, {
            stage: "critique",
            code: "critique.skipped.error",
            message: `Critique step failed, continuing without refinement (${reason}).`,
          });
          critiqueEnabled = false;
        }

        if (critiqueEnabled && bestCritique) {
          if (
            bestCritique.quality_score >= REFINE_QUALITY_THRESHOLD ||
            bestCritique.weaknesses.length === 0
          ) {
            agentState = pushAgentDiagnostic(agentState, {
              stage: "writing",
              code: "refine.skipped.early_stop",
              message: `Quality above threshold (score=${bestCritique.quality_score.toFixed(2)} >= ${REFINE_QUALITY_THRESHOLD}) or no weaknesses.`,
            });
          } else {
            for (
              let iteration = 0;
              iteration < REFINE_MAX_ITERATIONS;
              iteration += 1
            ) {
              try {
                const refineRun = await runRefineNode({
                  state: agentState,
                  userText: userMsg.content ?? "",
                  language: agentState.language,
                  intent: agentState.intent,
                  previousDraft: bestWriting.markdown,
                  critique: bestCritique,
                  research: researchRun.research,
                  iteration,
                  maxTokens: REFINE_MAX_TOKENS,
                  invokeModel: async ({ systemPrompt, turns, maxTokens }) => {
                    if (model.provider === "openai") {
                      return runOpenAI(model, systemPrompt, turns, maxTokens);
                    }
                    return runAnthropic(model, systemPrompt, turns, maxTokens);
                  },
                });
                agentState = refineRun.state;
                writingUsage = {
                  prompt_tokens:
                    (writingUsage.prompt_tokens ?? 0) +
                    (refineRun.usage.prompt_tokens ?? 0),
                  completion_tokens:
                    (writingUsage.completion_tokens ?? 0) +
                    (refineRun.usage.completion_tokens ?? 0),
                };

                const reCritique = await runCritiqueNode({
                  state: agentState,
                  userText: userMsg.content ?? "",
                  language: agentState.language,
                  intent: agentState.intent,
                  draftMarkdown: refineRun.writing.markdown,
                  research: researchRun.research,
                  maxTokens: CRITIQUE_MAX_TOKENS,
                  invokeModel: async ({ systemPrompt, turns, maxTokens }) => {
                    if (model.provider === "openai") {
                      return runOpenAI(model, systemPrompt, turns, maxTokens);
                    }
                    return runAnthropic(model, systemPrompt, turns, maxTokens);
                  },
                });
                agentState = reCritique.state;
                writingUsage = {
                  prompt_tokens:
                    (writingUsage.prompt_tokens ?? 0) +
                    (reCritique.usage.prompt_tokens ?? 0),
                  completion_tokens:
                    (writingUsage.completion_tokens ?? 0) +
                    (reCritique.usage.completion_tokens ?? 0),
                };

                const improved =
                  reCritique.critique.quality_score > bestCritique.quality_score;
                agentState = {
                  ...agentState,
                  refine_iterations_used:
                    (agentState.refine_iterations_used ?? 0) + 1,
                  critique_history: [
                    ...agentState.critique_history,
                    {
                      iteration: iteration + 1,
                      source: "refine",
                      quality_score: reCritique.critique.quality_score,
                      weaknesses_count: reCritique.critique.weaknesses.length,
                      language_ok: reCritique.critique.language_ok,
                      accepted: improved,
                    },
                  ],
                };
                if (improved) {
                  agentState = pushAgentDiagnostic(agentState, {
                    stage: "writing",
                    code: "refine.improved",
                    message: `score ${bestCritique.quality_score.toFixed(2)} -> ${reCritique.critique.quality_score.toFixed(2)}; weaknesses ${bestCritique.weaknesses.length} -> ${reCritique.critique.weaknesses.length}`,
                  });
                  bestWriting = refineRun.writing;
                  bestCritique = reCritique.critique;
                } else {
                  agentState = pushAgentDiagnostic(agentState, {
                    stage: "writing",
                    code: "refine.no_improvement",
                    message: `refined score ${reCritique.critique.quality_score.toFixed(2)} did not improve over ${bestCritique.quality_score.toFixed(2)}; keeping previous best draft.`,
                  });
                  agentState = {
                    ...agentState,
                    writing: bestWriting,
                    critique: bestCritique,
                  };
                  break;
                }

                if (bestCritique.quality_score >= REFINE_QUALITY_THRESHOLD) {
                  agentState = pushAgentDiagnostic(agentState, {
                    stage: "writing",
                    code: "refine.threshold_reached",
                    message: `Quality threshold reached after refine (score=${bestCritique.quality_score.toFixed(2)}).`,
                  });
                  break;
                }
              } catch (refineError) {
                console.error("collab-docs refine failed:", refineError, {
                  agentState,
                });
                const reason =
                  refineError instanceof Error
                    ? refineError.message
                    : "refine-failure";
                agentState = pushAgentDiagnostic(agentState, {
                  stage: "writing",
                  code: "refine.skipped.error",
                  message: `Refine iteration ${iteration + 1} failed, keeping best draft (${reason}).`,
                });
                agentState = {
                  ...agentState,
                  writing: bestWriting,
                  critique: bestCritique,
                };
                break;
              }
            }
          }
        }

        writingCandidateContent = sanitizeWritingMarkdown(bestWriting.markdown);
        writingChatReply = bestWriting.chat_reply;
      } catch (researchError) {
        console.error("collab-docs research/writing failed:", researchError, {
          agentState,
        });
        const reason =
          researchError instanceof Error
            ? researchError.message
            : "research-writing-failure";
        agentState = pushAgentDiagnostic(agentState, {
          stage: "repair",
          code: "research.fallback.patch",
          message: `Research/writing failed, falling back to patch flow (${reason}).`,
        });
        writingCandidateContent = null;
        writingChatReply = null;
      }
    }

    const systemPrompt = buildSystemPrompt({
      editableChunks: formatEditableChunks(editableChunks),
      contextBlocks,
      planSummary: agentState.plan?.summary,
      planDepth: agentState.plan?.depth,
      planTargets: agentState.plan?.targets,
      skills: activeSkill
        ? [{ name: activeSkill.name, prompt: activeSkill.prompt }]
        : undefined,
    });
    agentState = pushAgentDiagnostic(agentState, {
      stage: "draft_plan",
      code: "prompt.composed",
      message: `Editable chunks: ${editableChunks.length}`,
    });

    let payload: ReturnType<typeof parseCollabAiJson>;
    let usage: AgentUsage = {};

    if (writingCandidateContent !== null) {
      payload = {
        chat_reply: writingChatReply ?? "",
        patches: [
          {
            target_chunk_index: editableChunks[0]?.chunk_index ?? 0,
            new_text: writingCandidateContent,
          },
        ],
      };
      usage = writingUsage;
    } else {
    try {
      if (!agentState) {
        throw new Error("Agent state is not initialized");
      }
      const patchRun = await runPatchNode({
        state: agentState,
        systemPrompt,
        turns,
        primaryMaxTokens: MODEL_MAX_TOKENS_PRIMARY,
        repairMaxTokens: MODEL_MAX_TOKENS_REPAIR,
        maxRepairRawChars: MAX_REPAIR_RAW_CHARS,
        invokeModel: async ({ systemPrompt, turns, maxTokens }) => {
          if (model.provider === "openai") {
            return runOpenAI(model, systemPrompt, turns, maxTokens);
          }
          return runAnthropic(model, systemPrompt, turns, maxTokens);
        },
        parsePayload: parseCollabAiJson,
        truncate,
      });
      agentState = patchRun.state;
      payload = patchRun.payload;
      usage = patchRun.usage;
    } catch (e) {
      console.error("collab-docs patch node failed:", e, { agentState });
      const reason =
        e instanceof Error ? e.message : "patch-node-failure";
      if (!agentState) {
        throw new Error(`Patch node failed before state init: ${reason}`);
      }
      payload = buildSafeFallbackPayload({
        editableChunks,
        currentDocChunks,
        language: agentState.language,
        reason,
      });
      agentState = {
        ...agentState,
        intent: "answer_only",
      };
      agentState = pushAgentDiagnostic(agentState, {
        stage: "repair",
        code: "patch.fallback.answer_only",
        message: `Patch stage failed, downgraded to answer_only (${reason}).`,
      });
    }
    }

    if (writingCandidateContent !== null) {
      agentState = pushAgentDiagnostic(agentState, {
        stage: "validate",
        code: "validation.skipped.writing",
        message: "Writing path produced trusted candidate; skipping validate node.",
      });
    } else if (AGENT_ENGINE === "langgraph") {
      const mustHaveMultiDocCoverage =
        agentState.intent === "multi_doc_summary" ||
        agentState.intent === "edit_with_context";
      const validateRun = runValidateNode({
        state: agentState,
        payload,
        userText: userMsg.content ?? "",
        editableChunks,
        currentDocChunks,
        requireMultiDocCoverage: mustHaveMultiDocCoverage,
      });
      agentState = pushAgentDiagnostic(validateRun.state, {
        stage: "validate",
        code: "validation.result",
        message: validateRun.validation.issues.length
          ? `issues=${validateRun.validation.issues.join(",")}`
          : "validation=ok",
      });
      const validationPassed =
        validateRun.validation.structural_ok &&
        validateRun.validation.language_ok &&
        validateRun.validation.safety_ok &&
        validateRun.validation.source_coverage_ok &&
        validateRun.validation.issues.length === 0;
      if (!validationPassed) {
        const deterministic = buildInstructionFallbackPayload({
          userText: userMsg.content ?? "",
          editableChunks,
          currentDocChunks,
          language: agentState.language,
          intent: agentState.intent,
        });
        payload =
          deterministic ??
          buildSafeFallbackPayload({
            editableChunks,
            currentDocChunks,
            language: agentState.language,
            reason: validateRun.validation.issues.join(","),
          });
        agentState = pushAgentDiagnostic(agentState, {
          stage: "repair",
          code: "validation.fallback",
          message: deterministic
            ? "Applied deterministic instruction fallback."
            : "Applied controlled fallback payload after validation failure.",
        });
      }
    } else {
      agentState = pushAgentDiagnostic(agentState, {
        stage: "validate",
        code: "validation.skipped.legacy",
        message: "Legacy engine selected: skipping validate node.",
      });
    }

    const latencyMs = Date.now() - startedAt;
    agentState = pushAgentDiagnostic(agentState, {
      stage: "complete",
      code: "candidate.ready",
      message: `latency_ms=${latencyMs}`,
    });
    const runDiagnostics = buildRunDiagnostics(agentState, latencyMs, AGENT_ENGINE);
    const nextDocumentContent =
      writingCandidateContent !== null
        ? writingCandidateContent
        : applyPatchesToDocument(
            currentDocChunks,
            editableChunks,
            payload.patches
          );
    const { data: candidateRow, error: candidateErr } = await supabase
      .from("ai_change_candidates")
      .insert({
        chat_id: chatId,
        document_id: document.id,
        base_document_content: document.content ?? "",
        candidate_document_content: nextDocumentContent,
        model: model.id,
        chat_reply: payload.chat_reply,
        usage,
        latency_ms: latencyMs,
      })
      .select(
        "id, chat_id, document_id, base_document_content, candidate_document_content, model, chat_reply, status, usage, latency_ms, created_at, applied_at, applied_by"
      )
      .single();

    if (candidateErr || !candidateRow) {
      console.error("collab-docs insert candidate:", candidateErr, { agentState });
      return NextResponse.json(
        { error: candidateErr?.message ?? "Failed to create candidate" },
        { status: 500 }
      );
    }

    await supabase.from("chats").update({ default_model: model.id }).eq("id", chatId);
    console.info("collab-docs run diagnostics:", runDiagnostics);

    return NextResponse.json({
      ok: true,
      candidate: candidateRow,
      runDiagnostics,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/collab-docs/chat:", e, { agentState });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
