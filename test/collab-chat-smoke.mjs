import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function parseEnv(content) {
  const out = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

async function loadLocalEnv() {
  const entries = await Promise.all(
    [".env", ".env.local"].map(async (name) => {
      const full = path.resolve(projectRoot, name);
      try {
        const raw = await fs.readFile(full, "utf8");
        return parseEnv(raw);
      } catch {
        return {};
      }
    })
  );
  return Object.assign({}, ...entries);
}

function short(text, n = 180) {
  if (!text) return "";
  return text.length > n ? `${text.slice(0, n)}...` : text;
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createSessionToken(secret, username = "sasha") {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 12 * 60 * 60 * 1000;
  const payload = JSON.stringify({ username, issuedAt, expiresAt });
  const payloadB64 = base64Url(Buffer.from(payload, "utf8"));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64, "utf8")
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${payloadB64}.${signature}`;
}

async function main() {
  const env = await loadLocalEnv();
  const supabaseUrl = env.NEXT_PUBLIC_DOCS_SUPABASE_URL;
  const serviceKey = env.DOCS_SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const modelId = process.env.MODEL_ID || "gpt-4o-mini";
  const authSecret = env.AUTH_SECRET;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing docs Supabase env vars in .env.local");
  }
  if (!authSecret) {
    throw new Error("Missing AUTH_SECRET in .env/.env.local");
  }
  const sessionToken = createSessionToken(authSecret);
  const cookieHeader = `mindjar_session=${sessionToken}`;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: docs, error: docsErr } = await supabase
    .from("documents")
    .select("id, primary_chat_id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(3);
  if (docsErr || !docs?.length) {
    throw new Error(`Failed to load documents: ${docsErr?.message ?? "none"}`);
  }

  const primary = docs[0];
  let primaryChatId = primary.primary_chat_id;
  if (!primaryChatId) {
    const { data: ch, error: chErr } = await supabase
      .from("chats")
      .select("id")
      .eq("document_id", primary.id)
      .limit(1)
      .maybeSingle();
    if (chErr || !ch?.id) {
      throw new Error(`No chat for document ${primary.id}: ${chErr?.message ?? ""}`);
    }
    primaryChatId = ch.id;
  }
  const contextIds = docs.slice(1).map((d) => d.id);

  const fileAPath = path.resolve(projectRoot, "test/SCREEN_BUSINESS_LOGIC_UK.md");
  const fileBPath = path.resolve(
    projectRoot,
    "test/ANALYTICS_LOG_BEHAVIOR_REVIEW_2026-04-14.md"
  );
  const [fileA, fileB] = await Promise.all([
    fs.readFile(fileAPath, "utf8"),
    fs.readFile(fileBPath, "utf8"),
  ]);

  const scenarios = [
    {
      name: "replace-first-word",
      prompt: 'Заміни перше слово "Привіт" на "Хелло" і більше нічого не змінюй.',
      contextDocumentIds: [],
      checks: ["status_ok", "has_candidate", "doc_contains_hello"],
    },
    {
      name: "insert-short-note-top",
      prompt:
        "Додай після першого рядка коротку примітку з одного речення українською про тест diff.",
      contextDocumentIds: [],
      checks: ["status_ok", "has_candidate", "doc_mentions_test_diff"],
    },
    {
      name: "use-context-files",
      prompt: `Стисло додай 2 bullet points в кінець документа на основі цих нотаток:\n\nA)\n${short(
        fileA,
        1400
      )}\n\nB)\n${short(fileB, 1400)}`,
      contextDocumentIds: contextIds,
      checks: ["status_ok", "has_candidate", "delta_non_zero"],
    },
    {
      name: "cross-doc-important-summary-ru",
      prompt:
        "Используя 2 документа в контексте, добавь в конец документа новый раздел '# Важное по двум документам' с 8-12 пунктами: ключевые риски, узкие места в воронке, сильные сигналы удержания, и 3 практических приоритета на следующую неделю. Ответ строго на русском языке.",
      contextDocumentIds: contextIds,
      checks: [
        "status_ok",
        "has_candidate",
        "reply_cyrillic",
        "reply_mentions_section",
      ],
    },
    {
      name: "multi-doc-synthesize-one-ru",
      prompt:
        "Создай один документ на основе двух файлов в контексте: собери ключевые риски, инсайты и приоритетные шаги. Ответ строго на русском языке.",
      contextDocumentIds: contextIds,
      checks: [
        "status_ok",
        "has_candidate",
        "delta_non_zero",
        "reply_cyrillic",
      ],
    },
  ];

  console.log(
    `Using chat=${primaryChatId} doc=${primary.id} model=${modelId} contextDocs=${contextIds.length}`
  );

  let failures = 0;
  for (const s of scenarios) {
    const { data: inserted, error: msgErr } = await supabase
      .from("messages")
      .insert({
        chat_id: primaryChatId,
        role: "user",
        content: s.prompt,
        metadata: { smoke_test: true, scenario: s.name },
      })
      .select("id")
      .single();

    if (msgErr || !inserted?.id) {
      console.log(`\n[${s.name}] FAIL insert message: ${msgErr?.message}`);
      continue;
    }

    const started = Date.now();
    const res = await fetch(`${baseUrl}/api/collab-docs/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        chatId: primaryChatId,
        modelId,
        userMessageId: inserted.id,
        contextDocumentIds: s.contextDocumentIds,
      }),
    });
    const elapsed = Date.now() - started;
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.log(
        `\n[${s.name}] FAIL status=${res.status} elapsed=${elapsed}ms error=${json?.error ?? "unknown"}`
      );
      failures += 1;
      continue;
    }

    const candidate = json?.candidate;
    const runDiagnostics = json?.runDiagnostics;
    console.log(
      `\n[${s.name}] OK status=${res.status} elapsed=${elapsed}ms candidate=${candidate?.id ?? "n/a"}`
    );
    console.log(`chat_reply: ${short(candidate?.chat_reply ?? "", 200)}`);
    const deltaLen =
      (candidate?.candidate_document_content?.length ?? 0) -
      (candidate?.base_document_content?.length ?? 0);
    console.log(`delta_len=${deltaLen}`);
    if (runDiagnostics) {
      const tail = runDiagnostics.diagnostics_tail ?? [];
      const stageCodes = tail.map((d) => `${d.stage}:${d.code}`).join(" | ");
      console.log(
        `diagnostics: engine=${runDiagnostics.engine} stage=${runDiagnostics.stage ?? "n/a"} retries=${runDiagnostics.retries ?? 0} intent=${runDiagnostics.intent ?? "n/a"} issues=${
          runDiagnostics.validation?.issues?.join(",") ?? "none"
        }`
      );
      if (runDiagnostics.critique) {
        const c = runDiagnostics.critique;
        console.log(
          `critique: score=${(c.quality_score ?? 0).toFixed(2)} language_ok=${c.language_ok} weaknesses=${c.weaknesses?.length ?? 0}`
        );
        if ((c.weaknesses ?? []).length) {
          for (const w of c.weaknesses.slice(0, 3)) {
            console.log(`  - ${short(w, 180)}`);
          }
        }
      }
      const refineEvents = tail
        .filter((d) => typeof d.code === "string" && d.code.startsWith("refine."))
        .map((d) => d.code);
      if (refineEvents.length) {
        console.log(`refine_events: ${refineEvents.join(" -> ")}`);
      }
      const history = runDiagnostics.critique_history ?? [];
      if (history.length) {
        const summary = history
          .map(
            (h) =>
              `${h.source}#${h.iteration}:${(h.quality_score ?? 0).toFixed(2)}${
                h.accepted === false ? "(rejected)" : ""
              }`
          )
          .join(" -> ");
        console.log(
          `score_history: ${summary} | refine_iterations_used=${runDiagnostics.refine_iterations_used ?? 0}`
        );
      }
      if (stageCodes) {
        console.log(`diag_tail: ${stageCodes}`);
      }
    }

    const checks = Array.isArray(s.checks) ? s.checks : [];
    for (const check of checks) {
      if (check === "status_ok" && res.status !== 200) {
        failures += 1;
        console.log(`[${s.name}] CHECK FAIL: status_ok`);
      }
      if (check === "has_candidate" && !candidate?.id) {
        failures += 1;
        console.log(`[${s.name}] CHECK FAIL: has_candidate`);
      }
      if (check === "delta_non_zero" && deltaLen === 0) {
        failures += 1;
        console.log(`[${s.name}] CHECK FAIL: delta_non_zero`);
      }
      if (
        check === "reply_cyrillic" &&
        !/[а-яА-ЯіїєґІЇЄҐ]/.test(candidate?.chat_reply ?? "")
      ) {
        failures += 1;
        console.log(`[${s.name}] CHECK FAIL: reply_cyrillic`);
      }
      if (
        check === "reply_mentions_section" &&
        !/(раздел|section|розділ|пункт)/i.test(candidate?.chat_reply ?? "")
      ) {
        failures += 1;
        console.log(`[${s.name}] CHECK FAIL: reply_mentions_section`);
      }
      if (
        check === "doc_contains_hello" &&
        !/(хелло|hello)/i.test(candidate?.candidate_document_content ?? "")
      ) {
        failures += 1;
        console.log(`[${s.name}] CHECK FAIL: doc_contains_hello`);
      }
      if (
        check === "doc_mentions_test_diff" &&
        !/(тест diff|test diff)/i.test(candidate?.candidate_document_content ?? "")
      ) {
        failures += 1;
        console.log(`[${s.name}] CHECK FAIL: doc_mentions_test_diff`);
      }
    }
  }

  if (failures > 0) {
    throw new Error(`Smoke checks failed: ${failures}`);
  }
}

main().catch((e) => {
  console.error("Smoke test runner failed:", e);
  process.exit(1);
});
