/**
 * Canonical constants for the memory layer.
 *
 * Every number here comes directly from SSOT
 * `docs/2026/MindJar_consolidated_documentation_system_19_04_2026_03-16.md`.
 * Do not inline these numbers anywhere else; always import from this file.
 */

import type { MemoryItemType, SignalKind, Surface } from "./types";

/**
 * Active confidence thresholds — SSOT D.4.3.
 *
 * active_confidence = confidence * freshness_score.
 * Recomputed on every retrieval (do not trust cached value).
 */
export const ACTIVE_CONFIDENCE_RETRIEVAL_MIN = 0.3;
export const ACTIVE_CONFIDENCE_INSIGHT_MIN = 0.5;
export const ACTIVE_CONFIDENCE_NO_SOFTENER = 0.7;

/**
 * Decay half-life in days per memory item type — SSOT D.4.4.
 *
 * - `null` means no automatic decay.
 * - `stale` is a lifecycle status (D.1.3), not a type, so it has no
 *   independent half-life here.
 */
export const HALF_LIFE_DAYS: Record<MemoryItemType, number | null> = {
  immutable_fact: null,
  declared_preference: 120,
  declared_boundary: null,
  temporary_constraint: 30,
  observation: 14,
  hypothesis: 10,
  confirmed_insight: 60,
};

/**
 * Recalibration factors after pause — SSOT D.7.
 *
 * Applied to `active_confidence` if `days_since_last_checkin >= 7`.
 * Factor lives until the first completed check-in with text OR an
 * explicit confirmation in the memory screen.
 */
export const RECALIBRATION_FACTOR: Record<MemoryItemType, number> = {
  immutable_fact: 1.0,
  declared_preference: 1.0,
  declared_boundary: 1.0,
  temporary_constraint: 1.0,
  observation: 0.6,
  hypothesis: 0.6,
  confirmed_insight: 0.8,
};

/**
 * Pause threshold (days) that triggers recalibration — SSOT D.7.
 */
export const RECALIBRATION_PAUSE_DAYS = 7;

/**
 * Daily snapshot soft re-validation threshold — SSOT E.5.1.
 */
export const SNAPSHOT_SOFT_REVALIDATION_DAYS = 3;

/**
 * State machine thresholds — SSOT D.2.2.
 */
export const STATE_MACHINE = {
  observation_to_hypothesis: {
    min_consistent_observations: 3,
    window_days: 14,
    min_avg_signal_strength: 0.4,
  },
  hypothesis_to_confirmed: {
    path_a: {
      min_explicit_confirmations: 2,
      window_days: 30,
    },
    path_b: {
      min_explicit_confirmations: 1,
      min_corroborating_signals: 2,
      window_days: 21,
    },
  },
  hypothesis_to_stale: {
    no_support_days: 30,
    soft_reject_count: 2,
    min_confidence: 0.25,
  },
  confirmed_to_re_check: {
    contradicting_signals_count: 3,
    contradicting_window_days: 14,
  },
  re_check_to_confirmed: {
    min_confirmations: 2,
    window_days: 14,
  },
  re_check_to_stale: {
    no_resolution_days: 14,
  },
  stale_revival: {
    min_new_consistent_observations: 3,
    /** In P0b revival is manual-only via a flag; automatic only in P1. */
    automatic: false,
  },
} as const;

/**
 * Rollback window for mistaken user actions — SSOT D.2.4.
 */
export const ROLLBACK_WINDOW_HOURS = 24;

/**
 * User-level confidence score weights — SSOT D.4.1.
 * Ordering and weights must not be altered without an SSOT change.
 */
export const CONFIDENCE_SCORE_WEIGHTS = {
  total_sessions: 0.15,
  text_sessions_ratio: 0.2,
  confirmed_signals_count: 0.25,
  contradicted_signals_count: -0.15,
  days_active_in_last_14: 0.15,
  source_diversity: 0.1,
  avg_freshness: 0.1,
} as const;

/**
 * Log bases used by SSOT D.4.1 for session/signal normalization.
 */
export const CONFIDENCE_LOG_BASES = {
  total_sessions: 20,
  confirmed_signals_count: 10,
  contradicted_signals_count: 10,
} as const;

/**
 * Level thresholds for A / B / C / D — SSOT D.4.2.
 */
export const CONFIDENCE_LEVEL_THRESHOLDS = {
  B: {
    min_score: 0.2,
    max_score_exclusive: 0.45,
    min_total_sessions: 3,
    min_text_sessions_ratio: 0.3,
  },
  C: {
    min_score: 0.45,
    max_score_exclusive: 0.7,
    min_confirmed_signals_count: 3,
    min_days_active_in_last_14: 5,
  },
  D: {
    min_score: 0.7,
    min_confirmed_signals_count: 7,
    min_source_diversity: 3,
  },
  A: {
    /** Fallback level — SSOT D.4.2 last paragraph. */
    max_score_exclusive: 0.2,
    max_total_sessions_exclusive: 2,
  },
} as const;

/**
 * Signal strength formula weights for observation → hypothesis — SSOT D.2.2.
 */
export const SIGNAL_STRENGTH_WEIGHTS = {
  text_session_factor: 0.4,
  explicit_user_signal_factor: 0.3,
  cross_source_agreement: 0.2,
  recency_factor: 0.1,
} as const;

/**
 * Universal relevance formula weights — SSOT E.6.1.
 */
export const RELEVANCE_WEIGHTS = {
  active_confidence: 0.35,
  intent_match_score: 0.25,
  recency_score: 0.2,
  source_reliability: 0.15,
  diversity_bonus: 0.05,
} as const;

/**
 * Low-confidence retrieval fallback trigger — SSOT E.6.5.
 */
export const LOW_CONFIDENCE_SUM_THRESHOLD = 1.5;

/**
 * Per-surface retrieval budgets — SSOT E.6.2.
 * Numbers are marked `[TUNE AFTER P0A]` in the SSOT; they live here
 * as a single source for the portal and can be tuned post-P0a.
 */
export interface RetrievalBudget {
  tokens: number;
  items: number;
  summaries: number;
}

export const RETRIEVAL_BUDGET: Record<
  | "smart_summary_post_checkin"
  | "chat_reply"
  | "weekly_summary"
  | "self_discovery_go_deeper"
  | "plan_context"
  | "memory_screen",
  RetrievalBudget
> = {
  smart_summary_post_checkin: { tokens: 2000, items: 8, summaries: 3 },
  chat_reply: { tokens: 4000, items: 12, summaries: 5 },
  weekly_summary: { tokens: 6000, items: 15, summaries: 7 },
  self_discovery_go_deeper: { tokens: 2500, items: 5, summaries: 1 },
  plan_context: { tokens: 1000, items: 5, summaries: 0 },
  memory_screen: { tokens: 1500, items: 20, summaries: 0 },
};

/**
 * Latency budgets — SSOT E.11.
 */
export interface LatencyBudget {
  target_p95_ms: number;
  hard_ceiling_ms: number;
}

export const LATENCY_BUDGET: Record<
  | "session_card_normalization"
  | "sync_session_summary"
  | "smart_summary_generation"
  | "daily_snapshot_refresh"
  | "memory_screen_load"
  | "plan_generation"
  | "async_enrichment_full"
  | "safety_classifier",
  LatencyBudget
> = {
  session_card_normalization: { target_p95_ms: 100, hard_ceiling_ms: 300 },
  sync_session_summary: { target_p95_ms: 800, hard_ceiling_ms: 1500 },
  smart_summary_generation: { target_p95_ms: 1500, hard_ceiling_ms: 3000 },
  daily_snapshot_refresh: { target_p95_ms: 50, hard_ceiling_ms: 200 },
  memory_screen_load: { target_p95_ms: 500, hard_ceiling_ms: 1500 },
  plan_generation: { target_p95_ms: 300, hard_ceiling_ms: 1000 },
  async_enrichment_full: { target_p95_ms: 60_000, hard_ceiling_ms: 300_000 },
  safety_classifier: { target_p95_ms: 500, hard_ceiling_ms: 3000 },
} as const;

/**
 * Smart Summary output length budget — SSOT E.7.3 rule #6.
 */
export const SMART_SUMMARY_LENGTH = {
  default_min_words: 80,
  default_max_words: 150,
  quick_check_in_max_words: 50,
} as const;

/**
 * Smart Summary regeneration cap — SSOT E.7.4.
 */
export const SMART_SUMMARY_MAX_REGENERATIONS_PER_SESSION = 3;

/**
 * Async enrichment timing — SSOT E.1.2.
 */
export const ASYNC_ENRICHMENT_TIMING = {
  standard_ms: 60_000,
  acceptable_ms: 5 * 60_000,
  degraded_max_ms: 30 * 60_000,
} as const;

/**
 * Signal kind default reliability weights used inside relevance scoring
 * when no stronger per-item data is available. Derived from the intent of
 * SSOT D.5.1 (declaration / truth_confirmation > corroboration > resonance).
 * Kept here so there is a single point of reference.
 */
export const SIGNAL_RELIABILITY: Record<SignalKind, number> = {
  declaration: 1.0,
  truth_confirmation: 0.9,
  corroboration: 0.6,
  contradiction: 0.6,
  resonance: 0.2,
};

/**
 * Utility constant for surfaces available in SSOT E.10.3.
 * Not authoritative for retrieval intents — those use the keys in
 * `RETRIEVAL_BUDGET`.
 */
export const SURFACES: readonly Surface[] = [
  "smart_summary",
  "chat_reply",
  "weekly_summary",
  "plan",
  "memory_screen",
] as const;
