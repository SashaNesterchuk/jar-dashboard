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

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BODY_BYTES = 256 * 1024;
const MAX_CONTEXT_DOCS = 6;
const MAX_CONTEXT_CHARS_PER_DOC = 24_000;
const MAX_DOC_IN_PROMPT_CHARS = 100_000;
const MAX_PRIOR_MESSAGES = 48;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 24;

const requestSchema = z.object({
  chatId: z.string().uuid(),
  modelId: z.string().min(1),
  userMessageId: z.string().uuid(),
  contextDocumentIds: z.array(z.string().uuid()).max(8).optional(),
});

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
  documentBody: string;
  contextBlocks: string;
}): string {
  const doc = truncate(params.documentBody, MAX_DOC_IN_PROMPT_CHARS);
  const ctx = params.contextBlocks || "(none)";
  return `You are a collaborative Markdown document assistant for an internal dashboard.

Rules:
- Apply the user's request to the CURRENT DOCUMENT below.
- Return ONLY a single JSON object (no markdown code fences) with exactly two string keys:
  "chat_reply" — a short note shown in chat (what you changed or answered).
  "document_markdown" — the FULL new document body in Markdown (replace the entire document, not a diff).
- Preserve structure unless the user asks to change it.
- If the user only asks a question without editing, still return the same document in "document_markdown" unless they clearly want edits.

Attached context from other documents (for reference only):
${ctx}

CURRENT DOCUMENT:
---
${doc}
---

Output must be valid JSON.`;
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

async function runOpenAI(
  model: CollabModelDefinition,
  systemPrompt: string,
  turns: { role: "user" | "assistant"; content: string }[]
) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const openai = new OpenAI({ apiKey: key });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...turns.map((t) => ({ role: t.role, content: t.content })),
  ];
  const completion = await openai.chat.completions.create({
    model: model.id,
    messages,
    response_format: { type: "json_object" },
    max_tokens: 8192,
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
  turns: { role: "user" | "assistant"; content: string }[]
) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  const anthropic = new Anthropic({ apiKey: key });
  const msg = await anthropic.messages.create({
    model: model.id,
    max_tokens: 8192,
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
  try {
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

    const { chatId, modelId, userMessageId, contextDocumentIds } = parsed.data;
    const model = getCollabModel(modelId);
    if (!model || !COLLAB_MODELS.some((m) => m.id === modelId)) {
      return NextResponse.json({ error: "Unknown model" }, { status: 400 });
    }

    const supabase = getDocsSupabaseServiceClient();

    const { data: userMsg, error: userErr } = await supabase
      .from("messages")
      .select("id, chat_id, role, content")
      .eq("id", userMessageId)
      .single();

    if (userErr || !userMsg) {
      return NextResponse.json({ error: "User message not found" }, { status: 404 });
    }
    if (userMsg.chat_id !== chatId || userMsg.role !== "user") {
      return NextResponse.json({ error: "Invalid user message" }, { status: 400 });
    }

    const { data: document, error: docErr } = await supabase
      .from("documents")
      .select("id, chat_id, title, content")
      .eq("chat_id", chatId)
      .maybeSingle();

    if (docErr || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
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
    const ctxIds = (contextDocumentIds ?? []).filter(
      (id) => id !== document.id
    );
    const slice = ctxIds.slice(0, MAX_CONTEXT_DOCS);
    if (slice.length > 0) {
      const { data: ctxDocs, error: ctxErr } = await supabase
        .from("documents")
        .select("id, title, content")
        .in("id", slice);

      if (!ctxErr && ctxDocs?.length) {
        contextBlocks = ctxDocs
          .map(
            (d) =>
              `### ${d.title || "Untitled"} (${d.id})\n${truncate(d.content ?? "", MAX_CONTEXT_CHARS_PER_DOC)}`
          )
          .join("\n\n");
      }
    }

    const systemPrompt = buildSystemPrompt({
      documentBody: document.content ?? "",
      contextBlocks,
    });

    let raw: string;
    let usage: {
      prompt_tokens?: number;
      completion_tokens?: number;
    };

    try {
      if (model.provider === "openai") {
        const r = await runOpenAI(model, systemPrompt, turns);
        raw = r.text;
        usage = r.usage;
      } else {
        const r = await runAnthropic(model, systemPrompt, turns);
        raw = r.text;
        usage = r.usage;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM error";
      console.error("collab-docs LLM:", e);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    let payload: ReturnType<typeof parseCollabAiJson>;
    try {
      payload = parseCollabAiJson(raw);
    } catch (e) {
      console.error("collab-docs JSON parse:", e, raw.slice(0, 500));
      return NextResponse.json(
        { error: "Model returned invalid JSON" },
        { status: 502 }
      );
    }

    const { error: insAsstErr } = await supabase.from("messages").insert({
      chat_id: chatId,
      role: "assistant",
      content: payload.chat_reply,
      model: model.id,
      usage,
      metadata: { document_applied: true },
    });

    if (insAsstErr) {
      console.error("collab-docs insert assistant:", insAsstErr);
      return NextResponse.json({ error: insAsstErr.message }, { status: 500 });
    }

    const { error: updDocErr } = await supabase
      .from("documents")
      .update({ content: payload.document_markdown })
      .eq("id", document.id);

    if (updDocErr) {
      console.error("collab-docs update document:", updDocErr);
      return NextResponse.json({ error: updDocErr.message }, { status: 500 });
    }

    await supabase
      .from("chats")
      .update({ default_model: model.id })
      .eq("id", chatId);

    return NextResponse.json({
      ok: true,
      chat_reply: payload.chat_reply,
      usage,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/collab-docs/chat:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
