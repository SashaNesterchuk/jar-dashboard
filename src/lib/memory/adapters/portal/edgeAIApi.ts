import type {
  AIAdapter,
  EnrichmentInput,
  SafetyInput,
  SafetyResult,
  SmartSummaryInput,
  SmartSummaryOutput,
} from "../ai";
import type { SessionSummaryV2Enriched } from "../../types";

type Op = "smart_summary" | "enrichment" | "safety_classifier";

async function callMemoryAI<T>(
  operation: Op,
  input: Record<string, unknown>,
): Promise<T> {
  const response = await fetch("/api/memory/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, input }),
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `[memory.ai.edge] ${operation} failed (${response.status}): ${JSON.stringify(parsed)}`,
    );
  }
  return (parsed ?? {}) as T;
}

function toSmartSummaryOutput(data: Record<string, unknown>): SmartSummaryOutput {
  const advice =
    typeof data.advice === "string" ? data.advice : "Take one small grounding step.";
  const insight =
    typeof data.insight === "string"
      ? data.insight
      : "A meaningful pattern may be forming.";
  const affirmation =
    typeof data.affirmation === "string"
      ? data.affirmation
      : "I can respond to this moment with care.";
  const references_used = Array.isArray(data.references_used)
    ? data.references_used.filter((x): x is string => typeof x === "string")
    : [];
  const combined = `${advice} ${insight} ${affirmation}`.trim();
  const wc = Number(data.word_count);
  const safety = typeof data.safety_flag === "string" ? data.safety_flag : "none";
  return {
    advice,
    insight,
    affirmation,
    references_used,
    word_count:
      Number.isFinite(wc) && wc > 0
        ? wc
        : combined.split(/\s+/).filter(Boolean).length,
    safety_flag:
      safety === "none" || safety === "soft" || safety === "hard" || safety === "critical"
        ? safety
        : "none",
  };
}

function toEnrichment(
  data: Record<string, unknown>,
  sessionId: string,
): SessionSummaryV2Enriched {
  const themes = Array.isArray(data.themes_deep)
    ? data.themes_deep.filter((x): x is string => typeof x === "string")
    : [];
  const hypotheses = Array.isArray(data.candidate_hypotheses)
    ? data.candidate_hypotheses
        .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
        .map((x) => ({
          statement: typeof x.statement === "string" ? x.statement : "",
          strength: Math.max(0, Math.min(1, Number(x.strength ?? 0))),
          theme: typeof x.theme === "string" ? x.theme : "",
        }))
        .filter((x) => x.statement.length > 0 && x.theme.length > 0)
    : [];
  const crossSignals = Array.isArray(data.cross_session_signals)
    ? data.cross_session_signals.filter((x): x is string => typeof x === "string")
    : [];
  const eff =
    data.effectiveness_observation &&
    typeof data.effectiveness_observation === "object"
      ? (data.effectiveness_observation as Record<string, unknown>)
      : null;

  return {
    session_id: sessionId,
    summary_version: "v2_enriched",
    enriched_at: new Date().toISOString(),
    themes_deep: themes,
    candidate_hypotheses: hypotheses,
    cross_session_signals: crossSignals,
    effectiveness_observation: eff
      ? {
          practice_type:
            typeof eff.practice_type === "string" ? eff.practice_type : "unknown",
          observation:
            typeof eff.observation === "string" ? eff.observation : "",
        }
      : null,
  };
}

function toSafety(data: Record<string, unknown>): SafetyResult {
  const flag = typeof data.flag === "string" ? data.flag : "none";
  const action =
    typeof data.suggested_action === "string"
      ? data.suggested_action
      : "regenerate";
  return {
    flag:
      flag === "none" || flag === "soft" || flag === "hard" || flag === "critical"
        ? flag
        : "none",
    reason: typeof data.reason === "string" ? data.reason : "ok",
    suggested_action:
      action === "regenerate" ||
      action === "safe_template" ||
      action === "crisis_flow" ||
      action === "manual_review"
        ? action
        : "regenerate",
    classifier_latency_ms: 1,
  };
}

export const edgeApiAIAdapter: AIAdapter = {
  async generateSmartSummary(input: SmartSummaryInput): Promise<SmartSummaryOutput> {
    const data = await callMemoryAI<Record<string, unknown>>(
      "smart_summary",
      input as unknown as Record<string, unknown>,
    );
    return toSmartSummaryOutput(data);
  },

  async generateEnrichment(
    input: EnrichmentInput,
  ): Promise<SessionSummaryV2Enriched> {
    const data = await callMemoryAI<Record<string, unknown>>(
      "enrichment",
      input as unknown as Record<string, unknown>,
    );
    return toEnrichment(data, input.session_card.session_id);
  },

  async runSafetyClassifier(input: SafetyInput): Promise<SafetyResult> {
    const data = await callMemoryAI<Record<string, unknown>>(
      "safety_classifier",
      input as unknown as Record<string, unknown>,
    );
    return toSafety(data);
  },
};
