/**
 * Safe templates (SSOT E.10.5) and helpers for fallback flows
 * (SSOT E.10.6, F.1.3).
 *
 * Pure. Returns literal `SmartSummaryOutput` values so the orchestrator
 * can hand them to the UI without another AI call.
 */

import type { SmartSummaryOutput } from "../adapters/ai";
import type { Surface } from "../types";

/**
 * Core sparse template (SSOT E.10.5) — used when data is insufficient,
 * or when the model / classifier failed.
 */
export const SPARSE_SAFE_TEMPLATE = {
  advice:
    "A short pause today might be enough. Even one breath, slower than usual.",
  insight:
    "It's still early — I'm curious about what feels most present for you.",
  affirmation: "I can show up for myself in any small way today.",
} as const;

/**
 * Crisis fallback text (SSOT F.3 minimum — safe crisis template).
 * Does NOT claim clinical support; redirects to resources.
 */
export const CRISIS_SAFE_TEMPLATE = {
  advice:
    "If you're in crisis, please reach out to a local helpline or trusted person right now.",
  insight:
    "This sounds really hard. I'm not a substitute for support that can reach you in this moment.",
  affirmation: "I can tell someone what is happening and let support reach me.",
} as const;

export type SafeTemplateReason =
  | "data_sparse"
  | "classifier_timeout"
  | "classifier_failed"
  | "model_call_failed"
  | "retrieval_empty"
  | "profile_missing"
  | "max_regenerations_exceeded";

export interface BuildSafeSummaryInput {
  reason: SafeTemplateReason;
  /** Currently unused in output body, but recorded in metadata for observability. */
  surface?: Surface;
}

/**
 * Produces a `SmartSummaryOutput` backed by a safe template. The
 * `safety_flag` stays `none` because the fallback itself is policy-safe.
 * The `input.reason` is echoed back in `references_used` so downstream
 * audit/logging surfaces can attribute the template to its trigger
 * without another round-trip.
 */
export function buildSafeSmartSummary(
  input: BuildSafeSummaryInput,
): SmartSummaryOutput {
  const tpl = SPARSE_SAFE_TEMPLATE;
  const text = `${tpl.advice} ${tpl.insight} ${tpl.affirmation}`;
  return {
    advice: tpl.advice,
    insight: tpl.insight,
    affirmation: tpl.affirmation,
    references_used: [`safe_template:${input.reason}`],
    word_count: countWords(text),
    safety_flag: "none",
  };
}

/**
 * Produces a `SmartSummaryOutput` using the crisis safe template. The
 * `safety_flag` reflects the routing decision.
 */
export function buildCrisisSmartSummary(): SmartSummaryOutput {
  const tpl = CRISIS_SAFE_TEMPLATE;
  const text = `${tpl.advice} ${tpl.insight} ${tpl.affirmation}`;
  return {
    advice: tpl.advice,
    insight: tpl.insight,
    affirmation: tpl.affirmation,
    references_used: [],
    word_count: countWords(text),
    safety_flag: "critical",
  };
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}
