/**
 * Deterministic `AIAdapter` for portal smoke tests and non-production
 * demos. Produces outputs that are:
 *   - Shape-correct (`SmartSummaryOutput`, `SafetyResult`,
 *     `SessionSummaryV2Enriched`).
 *   - Always reference at least one `user_stated` / emotion / trigger
 *     (SSOT E.7.3 #1).
 *   - Free of forbidden language (SSOT D.4.6).
 *
 * Consumers can override individual methods for targeted tests by
 * calling `createPortalDevAIAdapter({ ... })`.
 */

import type {
  AIAdapter,
  EnrichmentInput,
  SafetyInput,
  SafetyResult,
  SmartSummaryInput,
  SmartSummaryOutput,
} from "../ai";
import type {
  SessionSummaryV1Sync,
  SessionSummaryV2Enriched,
} from "../../types";

export interface PortalDevAIOverrides {
  generateSmartSummary?: (
    input: SmartSummaryInput,
  ) => Promise<SmartSummaryOutput>;
  generateEnrichment?: (
    input: EnrichmentInput,
  ) => Promise<SessionSummaryV2Enriched>;
  runSafetyClassifier?: (input: SafetyInput) => Promise<SafetyResult>;
}

export function createPortalDevAIAdapter(
  overrides: PortalDevAIOverrides = {},
): AIAdapter {
  return {
    generateSmartSummary:
      overrides.generateSmartSummary ?? defaultGenerateSmartSummary,
    generateEnrichment:
      overrides.generateEnrichment ?? defaultGenerateEnrichment,
    runSafetyClassifier:
      overrides.runSafetyClassifier ?? defaultRunSafetyClassifier,
  };
}

async function defaultGenerateSmartSummary(
  input: SmartSummaryInput,
): Promise<SmartSummaryOutput> {
  const card = input.session_card;
  const emotion = card.selected_emotions[0]?.label;
  const trigger = card.selected_triggers[0]?.label;
  const text = (card.user_stated_text ?? "").trim();
  const firstWord = text.split(/\s+/).find((w) => w.length > 3) ?? null;

  const reference = emotion ?? trigger ?? firstWord ?? "what you shared today";
  const mood = card.entry_mood ?? "today";

  // SSOT C.4.2: free baseline is a short basic summary; premium richens
  // the surface via additional cross-session / micro-callback lines
  // (C.4.3). The portal toggle flips `is_premium` at the adapter layer.
  const advice = input.is_premium
    ? `Take one slow breath and ground yourself for a minute, especially around ${reference}. If it feels useful, name one small next step you can take today.`
    : `Take one slow breath and ground yourself for a minute, especially around ${reference}.`;

  const insightBase =
    input.confidence_level === "A"
      ? `I'm noticing ${reference} came up — I'm curious about what feels most present.`
      : `A pattern seems to be forming around ${reference} — brief grounding tends to help.`;

  const crossRef = firstPriorThemeMention(input);
  const insight =
    input.is_premium && crossRef
      ? `${insightBase} Over the past few sessions, ${crossRef} has shown up more than once.`
      : insightBase;

  const affirmation = `I can meet this ${mood} moment with care.`;

  const references = [reference];
  if (input.is_premium && crossRef && !references.includes(crossRef)) {
    references.push(crossRef);
  }

  const combined = `${advice} ${insight} ${affirmation}`;
  return {
    advice,
    insight,
    affirmation,
    references_used: references,
    word_count: combined.split(/\s+/).filter(Boolean).length,
    safety_flag: "none",
  };
}

function firstPriorThemeMention(input: SmartSummaryInput): string | null {
  // `SmartSummaryInput` (see adapters/ai.ts) exposes the recent
  // summaries as `recent_summaries`. We surface the first obvious theme
  // that repeats across sessions so premium output earns its weight via
  // SSOT C.4.3 (day-2+ micro-callback).
  const recent = (input.recent_summaries ??
    []) as readonly SessionSummaryV1Sync[];
  for (const s of recent) {
    const first = s?.themes_obvious?.[0];
    if (first && first.trim().length > 0) return first;
  }
  return null;
}

async function defaultGenerateEnrichment(
  input: EnrichmentInput,
): Promise<SessionSummaryV2Enriched> {
  const triggers = input.session_card.selected_triggers.map((t) => t.label);
  return {
    session_id: input.session_card.session_id,
    summary_version: "v2_enriched",
    enriched_at: new Date().toISOString(),
    themes_deep: triggers,
    candidate_hypotheses: [],
    cross_session_signals: [],
    effectiveness_observation: null,
  };
}

async function defaultRunSafetyClassifier(
  input: SafetyInput,
): Promise<SafetyResult> {
  // Rule 1: any avoided topic mention → hard.
  for (const topic of input.avoided_topics) {
    if (topic.trim() === "") continue;
    const pattern = new RegExp(
      `\\b${topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    if (pattern.test(input.text)) {
      return {
        flag: "hard",
        reason: "avoided_topic_mention",
        suggested_action: "safe_template",
        classifier_latency_ms: 1,
      };
    }
  }

  // Rule 2: crisis markers → critical.
  if (/\b(suicide|kill myself|end it all|self[- ]?harm)\b/i.test(input.text)) {
    return {
      flag: "critical",
      reason: "crisis_indicator",
      suggested_action: "crisis_flow",
      classifier_latency_ms: 1,
    };
  }

  return {
    flag: "none",
    reason: "ok",
    suggested_action: "regenerate",
    classifier_latency_ms: 1,
  };
}

export const portalDevAIAdapter: AIAdapter = createPortalDevAIAdapter();
