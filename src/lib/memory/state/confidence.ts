/**
 * Confidence scoring and calibration — SSOT D.4.
 *
 * Pure functions. No side effects. Time values are provided by caller
 * to keep everything deterministic and easy to test.
 */

import {
  CONFIDENCE_LEVEL_THRESHOLDS,
  CONFIDENCE_LOG_BASES,
  CONFIDENCE_SCORE_WEIGHTS,
} from "../constants";
import type { ConfidenceLevel, ConfidenceScoreInputs } from "../types";

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function logRatio(value: number, base: number): number {
  return Math.log10(Math.max(value, 0) + 1) / Math.log10(base);
}

/**
 * SSOT D.4.1 — user_confidence_score.
 *
 *   user_confidence_score = clamp(
 *       0.15 * log10(total_sessions + 1) / log10(20)
 *     + 0.20 * text_sessions_ratio
 *     + 0.25 * log10(confirmed_signals_count + 1) / log10(10)
 *     - 0.15 * log10(contradicted_signals_count + 1) / log10(10)
 *     + 0.15 * (days_active_in_last_14 / 14)
 *     + 0.10 * (source_diversity / 8)
 *     + 0.10 * avg_freshness
 *     , 0, 1)
 */
export function computeUserConfidenceScore(
  inputs: ConfidenceScoreInputs,
): number {
  const w = CONFIDENCE_SCORE_WEIGHTS;
  const b = CONFIDENCE_LOG_BASES;

  const score =
    w.total_sessions * logRatio(inputs.total_sessions, b.total_sessions) +
    w.text_sessions_ratio * clamp(inputs.text_sessions_ratio, 0, 1) +
    w.confirmed_signals_count *
      logRatio(inputs.confirmed_signals_count, b.confirmed_signals_count) +
    w.contradicted_signals_count *
      logRatio(
        inputs.contradicted_signals_count,
        b.contradicted_signals_count,
      ) +
    w.days_active_in_last_14 *
      (clamp(inputs.days_active_in_last_14, 0, 14) / 14) +
    w.source_diversity * (clamp(inputs.source_diversity, 0, 8) / 8) +
    w.avg_freshness * clamp(inputs.avg_freshness, 0, 1);

  return clamp(score, 0, 1);
}

/**
 * SSOT D.4.2 — resolve confidence level A/B/C/D.
 *
 * Algorithm:
 *   1. Pick preferred level by score range alone (first pass).
 *   2. If the preferred level's `min_conditions` are not satisfied,
 *      walk down to the nearest lower level whose `min_conditions`
 *      are satisfied. Score-range upper bounds (`max_score_exclusive`)
 *      are NOT re-checked during walk-down: SSOT D.4.2 explicitly
 *      requires falling back to the nearest lower level by conditions
 *      regardless of score range.
 *   3. `min_score` floors are still respected so we never promote
 *      above what the score warrants.
 *   4. Level A has its own definition (`score < 0.20` OR
 *      `total_sessions < 2`) and is the safe fallback.
 */
export function resolveConfidenceLevel(
  score: number,
  inputs: ConfidenceScoreInputs,
): ConfidenceLevel {
  const t = CONFIDENCE_LEVEL_THRESHOLDS;

  // Level A is definitional when score < 0.20 OR total_sessions < 2.
  if (
    score < t.A.max_score_exclusive ||
    inputs.total_sessions < t.A.max_total_sessions_exclusive
  ) {
    return "A";
  }

  const conditions = {
    D:
      score >= t.D.min_score &&
      inputs.confirmed_signals_count >= t.D.min_confirmed_signals_count &&
      inputs.source_diversity >= t.D.min_source_diversity,
    C:
      score >= t.C.min_score &&
      inputs.confirmed_signals_count >= t.C.min_confirmed_signals_count &&
      inputs.days_active_in_last_14 >= t.C.min_days_active_in_last_14,
    B:
      score >= t.B.min_score &&
      inputs.total_sessions >= t.B.min_total_sessions &&
      inputs.text_sessions_ratio >= t.B.min_text_sessions_ratio,
  };

  const order: ConfidenceLevel[] = ["D", "C", "B"];
  let preferredIndex: number;
  if (score >= t.D.min_score) preferredIndex = 0;
  else if (score >= t.C.min_score) preferredIndex = 1;
  else preferredIndex = 2;

  for (let i = preferredIndex; i < order.length; i += 1) {
    const level = order[i];
    if (conditions[level as "B" | "C" | "D"]) return level;
  }
  return "A";
}

/**
 * SSOT D.4.3 — active_confidence.
 *
 *   active_confidence = confidence * freshness_score
 *
 * This value is recomputed at every retrieval, not trusted from cache.
 */
export function computeActiveConfidence(
  confidence: number,
  freshnessScore: number,
): number {
  return clamp(confidence, 0, 1) * clamp(freshnessScore, 0, 1);
}

export const __internal = { clamp, logRatio };
