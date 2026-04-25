/**
 * Smart Summary orchestrator. SSOT E.7 + E.9.
 *
 * Pipeline (per SSOT E.9):
 *   1. Build prompt context (SSOT E.7.1).
 *   2. Call `AIAdapter.generateSmartSummary`.
 *   3. Post-generation checks:
 *        a. Forbidden language (SSOT D.4.6) — hard fail.
 *        b. Avoided topics (SSOT F.2.2) — hard fail.
 *        c. Self-checks (SSOT E.7.3 #1, #2) — regenerate.
 *   4. Safety classifier (SSOT F.1).
 *   5. Flag routing:
 *        - `none` → show.
 *        - `soft` → regenerate once with hint (SSOT F.1.2).
 *        - `hard` → safe template + manual review tag.
 *        - `critical` → crisis template (SSOT F.3 minimum).
 *   6. Hard limits:
 *        - Max 3 regenerations (SSOT E.7.4) → `max_regenerations_exceeded`
 *          fallback.
 */

import type {
  AIAdapter,
  SmartSummaryInput,
  SmartSummaryOutput,
} from "../adapters/ai";
import type { ClockAdapter } from "../adapters/clock";
import type { TelemetryAdapter } from "../adapters/telemetry";
import type {
  MemoryItem,
  SessionCard,
  SessionSummaryV1Sync,
  StableProfile,
  Surface,
} from "../types";
import {
  buildSafeSmartSummary,
  buildCrisisSmartSummary,
} from "./safeTemplates";
import {
  assertNoForbiddenLanguage,
  ForbiddenLanguageError,
} from "./forbiddenLanguage";
import { runSelfChecks } from "./selfCheck";
import { containsAvoidedTopic } from "../safety/avoidedTopics";
import { runSafetyClassifier } from "../safety/classifier";

/**
 * SSOT E.7.4 — "Максимум 3 regenerations per session".
 */
export const MAX_REGENERATIONS = 3;

export interface SmartSummaryOrchestratorDeps {
  ai: AIAdapter;
  clock: ClockAdapter;
  telemetry?: TelemetryAdapter;
}

export interface GenerateSmartSummaryParams {
  session_card: SessionCard;
  memory_items: readonly MemoryItem[];
  recent_summaries: readonly SessionSummaryV1Sync[];
  stable_profile: StableProfile | null;
  avoided_topics: readonly string[];
  is_premium: boolean;
}

export type SmartSummaryTerminalReason =
  | "ok"
  | "forbidden_language"
  | "avoided_topic_mention"
  | "self_check_failed"
  | "safety_hard"
  | "safety_critical"
  | "safety_timeout"
  | "max_regenerations_exceeded"
  | "model_call_failed";

export interface SmartSummaryRunResult {
  output: SmartSummaryOutput;
  reason: SmartSummaryTerminalReason;
  regenerations_used: number;
  safety_timed_out: boolean;
}

export async function generateSmartSummary(
  deps: SmartSummaryOrchestratorDeps,
  params: GenerateSmartSummaryParams,
): Promise<SmartSummaryRunResult> {
  const profile = params.stable_profile;
  const confidence_level = profile?.confidence_level ?? "A";

  // SSOT E.10.6 — retrieval empty forces level A + safe template.
  if (params.memory_items.length === 0 && params.recent_summaries.length === 0 && profile == null) {
    return {
      output: buildSafeSmartSummary({ reason: "retrieval_empty", surface: SURFACE }),
      reason: "ok",
      regenerations_used: 0,
      safety_timed_out: false,
    };
  }

  const aiInput: SmartSummaryInput = {
    session_card: params.session_card,
    memory_items: params.memory_items,
    recent_summaries: params.recent_summaries,
    stable_profile: profile,
    confidence_level,
    avoided_topics: params.avoided_topics,
    is_premium: params.is_premium,
  };

  for (let attempt = 0; attempt <= MAX_REGENERATIONS; attempt++) {
    let candidate: SmartSummaryOutput;
    try {
      candidate = await deps.ai.generateSmartSummary({
        ...aiInput,
        ...(attempt > 0 ? { avoided_topics: params.avoided_topics } : {}),
      });
    } catch {
      return {
        output: buildSafeSmartSummary({ reason: "model_call_failed", surface: SURFACE }),
        reason: "model_call_failed",
        regenerations_used: attempt,
        safety_timed_out: false,
      };
    }

    const combined = toCombinedText(candidate);

    // Gate 1: forbidden language (SSOT D.4.6).
    try {
      assertNoForbiddenLanguage(combined);
    } catch (e) {
      if (e instanceof ForbiddenLanguageError && attempt < MAX_REGENERATIONS) {
        continue; // regenerate
      }
      return {
        output: buildSafeSmartSummary({ reason: "max_regenerations_exceeded", surface: SURFACE }),
        reason: "forbidden_language",
        regenerations_used: attempt,
        safety_timed_out: false,
      };
    }

    // Gate 2: avoided topic mention (SSOT F.2.2).
    if (containsAvoidedTopic(combined, params.avoided_topics)) {
      if (attempt < MAX_REGENERATIONS) continue;
      return {
        output: buildSafeSmartSummary({ reason: "max_regenerations_exceeded", surface: SURFACE }),
        reason: "avoided_topic_mention",
        regenerations_used: attempt,
        safety_timed_out: false,
      };
    }

    // Gate 3: self-checks (SSOT E.7.3 #1, #2).
    const sc = runSelfChecks(candidate, {
      session_card: params.session_card,
      stable_profile: profile,
    });
    if (!sc.ok) {
      if (attempt < MAX_REGENERATIONS) continue;
      return {
        output: buildSafeSmartSummary({ reason: "max_regenerations_exceeded", surface: SURFACE }),
        reason: "self_check_failed",
        regenerations_used: attempt,
        safety_timed_out: false,
      };
    }

    // Gate 4: safety classifier (SSOT F.1).
    const classifier = await runSafetyClassifier({
      ai: deps.ai,
      clock: deps.clock,
      telemetry: deps.telemetry,
      input: {
        text: combined,
        avoided_topics: params.avoided_topics,
        user_state: {
          mood: params.session_card.entry_mood ?? undefined,
          themes: params.session_card.selected_triggers.map((t) => t.label),
          recent_signals: params.recent_summaries
            .slice(0, 3)
            .flatMap((s) => s.themes_obvious),
        },
      },
      surface: SURFACE,
      user_id: params.session_card.user_id,
      session_id: params.session_card.session_id,
      output_for_hash: combined,
    });

    const flag = classifier.result.flag;

    if (flag === "critical") {
      return {
        output: buildCrisisSmartSummary(), // SSOT F.3 minimum
        reason: "safety_critical",
        regenerations_used: attempt,
        safety_timed_out: classifier.timed_out,
      };
    }

    if (flag === "hard") {
      if (attempt < MAX_REGENERATIONS && classifier.result.suggested_action === "regenerate") {
        continue;
      }
      return {
        output: buildSafeSmartSummary({ reason: "classifier_failed", surface: SURFACE }),
        reason: "safety_hard",
        regenerations_used: attempt,
        safety_timed_out: classifier.timed_out,
      };
    }

    if (flag === "soft") {
      // SSOT F.1.2 — soft: regenerate once. If already at soft on
      // retry, show as-is. We track the single-retry rule by
      // continuing only when `attempt === 0`.
      if (attempt === 0) continue;
      // On the retry we keep the output; classifier_timeout is also
      // `soft`, in which case we emit the safe template instead.
      if (classifier.timed_out) {
        return {
          output: buildSafeSmartSummary({ reason: "classifier_timeout", surface: SURFACE }),
          reason: "safety_timeout",
          regenerations_used: attempt,
          safety_timed_out: true,
        };
      }
      return {
        output: { ...candidate, safety_flag: "soft" },
        reason: "ok",
        regenerations_used: attempt,
        safety_timed_out: false,
      };
    }

    // flag === "none"
    return {
      output: { ...candidate, safety_flag: "none" },
      reason: "ok",
      regenerations_used: attempt,
      safety_timed_out: false,
    };
  }

  // Loop exited without success — SSOT E.7.4 hard ceiling.
  return {
    output: buildSafeSmartSummary({ reason: "max_regenerations_exceeded", surface: SURFACE }),
    reason: "max_regenerations_exceeded",
    regenerations_used: MAX_REGENERATIONS,
    safety_timed_out: false,
  };
}

const SURFACE: Surface = "smart_summary";

function toCombinedText(output: SmartSummaryOutput): string {
  return [output.advice, output.insight, output.affirmation, output.summary ?? ""]
    .join("\n")
    .trim();
}
