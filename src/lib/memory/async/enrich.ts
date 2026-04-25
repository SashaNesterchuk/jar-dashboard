/**
 * Async enrichment — SessionSummaryV2Enriched builder.
 *
 * SSOT E.4 v2 + SSOT E.7 pipeline step 2 (async enrichment). Runs on
 * `AIAdapter.generateEnrichment`, folds in recent cross-session context
 * from storage, and guards the output against forbidden language so
 * downstream retrieval / smart summary never sees diagnostic phrasing.
 *
 * This module is pure-ish: it orchestrates the AI adapter + forbidden
 * language detector, both of which are themselves pure given their
 * inputs. Persistence belongs to the caller (hook / API route).
 */

import type { AIAdapter, EnrichmentInput } from "../adapters/ai";
import type { TelemetryAdapter } from "../adapters/telemetry";
import type { ClockAdapter } from "../adapters/clock";
import { detectForbiddenLanguage } from "../generation/forbiddenLanguage";
import type {
  CandidateHypothesis,
  SessionCard,
  SessionSummaryV1Sync,
  SessionSummaryV2Enriched,
} from "../types";

export interface EnrichSessionDeps {
  ai: AIAdapter;
  clock: ClockAdapter;
  telemetry?: TelemetryAdapter;
}

export interface EnrichSessionParams {
  session_card: SessionCard;
  sync_summary: SessionSummaryV1Sync;
  recent_context: readonly SessionSummaryV1Sync[];
}

export type EnrichTerminalReason =
  | "ok"
  | "forbidden_language"
  | "model_call_failed";

export interface EnrichSessionResult {
  summary: SessionSummaryV2Enriched;
  reason: EnrichTerminalReason;
}

export async function enrichSession(
  deps: EnrichSessionDeps,
  params: EnrichSessionParams,
): Promise<EnrichSessionResult> {
  const aiInput: EnrichmentInput = {
    session_card: params.session_card,
    sync_summary: params.sync_summary,
    recent_context: params.recent_context,
  };

  let candidate: SessionSummaryV2Enriched;
  try {
    candidate = await deps.ai.generateEnrichment(aiInput);
  } catch (e) {
    deps.telemetry?.capture("memory.enrichment_failed", {
      session_id: params.session_card.session_id,
      user_id: params.session_card.user_id,
      reason: "model_call_failed",
      timestamp: deps.clock.now().toISOString(),
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      summary: buildEmptyV2(params, deps.clock.now()),
      reason: "model_call_failed",
    };
  }

  // SSOT D.4.6 — strip enrichment output of any diagnostic phrasing.
  const hypothesesText = candidate.candidate_hypotheses
    .map((h) => h.statement)
    .join("\n");
  const combined = [
    ...candidate.themes_deep,
    ...candidate.cross_session_signals,
    hypothesesText,
    candidate.effectiveness_observation?.observation ?? "",
  ].join("\n");

  const forbidden = detectForbiddenLanguage(combined);
  if (forbidden.length > 0) {
    deps.telemetry?.capture("memory.enrichment_rejected", {
      session_id: params.session_card.session_id,
      user_id: params.session_card.user_id,
      reason: "forbidden_language",
      categories: forbidden.map((f) => f.category),
      timestamp: deps.clock.now().toISOString(),
    });
    return {
      summary: buildEmptyV2(params, deps.clock.now()),
      reason: "forbidden_language",
    };
  }

  const sanitized: SessionSummaryV2Enriched = {
    ...candidate,
    session_id: params.session_card.session_id,
    summary_version: "v2_enriched",
    enriched_at: candidate.enriched_at || deps.clock.now().toISOString(),
    candidate_hypotheses: clampHypotheses(candidate.candidate_hypotheses),
  };

  deps.telemetry?.capture("memory.enrichment_completed", {
    session_id: params.session_card.session_id,
    user_id: params.session_card.user_id,
    themes_count: sanitized.themes_deep.length,
    hypotheses_count: sanitized.candidate_hypotheses.length,
    timestamp: deps.clock.now().toISOString(),
  });

  return { summary: sanitized, reason: "ok" };
}

function buildEmptyV2(
  params: EnrichSessionParams,
  now: Date,
): SessionSummaryV2Enriched {
  return {
    session_id: params.session_card.session_id,
    summary_version: "v2_enriched",
    enriched_at: now.toISOString(),
    themes_deep: [],
    candidate_hypotheses: [],
    cross_session_signals: [],
    effectiveness_observation: null,
  };
}

function clampHypotheses(
  hs: readonly CandidateHypothesis[],
): CandidateHypothesis[] {
  return hs.map((h) => ({
    statement: h.statement,
    strength: clamp01(h.strength),
    theme: h.theme,
  }));
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
