/**
 * Post-pause recalibration — SSOT D.7.
 *
 * When `days_since_last_checkin >= 7`:
 *   - `observation` / `hypothesis` items: factor 0.6 on active_confidence.
 *   - `confirmed_insight` items: factor 0.8 on active_confidence.
 *   - Facts (`immutable_fact`) and declared (`declared_preference`,
 *     `declared_boundary`, `temporary_constraint`): no change.
 *
 * Factor applies until the first new meaningful signal:
 *   - a completed check-in with text, OR
 *   - an explicit confirmation in the memory screen.
 *
 * This module is pure and does not mutate items — it computes the
 * effective factor and reports whether an incoming signal should clear
 * it. Persistence of the "currently under recalibration" flag is the
 * storage layer's job (EPIC 3+).
 */

import {
  RECALIBRATION_FACTOR,
  RECALIBRATION_PAUSE_DAYS,
} from "../constants";
import type { MemoryItemType, SourceType } from "../types";
import type { SignalId } from "./signalRegistry";

export function isPauseExceeded(daysSinceLastCheckIn: number): boolean {
  return daysSinceLastCheckIn >= RECALIBRATION_PAUSE_DAYS;
}

export function recalibrationFactor(type: MemoryItemType): number {
  return RECALIBRATION_FACTOR[type];
}

/**
 * Apply recalibration to a freshly-computed active_confidence.
 *
 * @param rawActiveConfidence  value produced by `computeActiveConfidence`
 * @param type                 memory item type
 * @param daysSinceLastCheckIn days since the user's last check-in
 */
export function applyRecalibration(
  rawActiveConfidence: number,
  type: MemoryItemType,
  daysSinceLastCheckIn: number,
): number {
  if (!isPauseExceeded(daysSinceLastCheckIn)) return rawActiveConfidence;
  const factor = recalibrationFactor(type);
  const out = rawActiveConfidence * factor;
  if (out < 0) return 0;
  if (out > 1) return 1;
  return out;
}

/**
 * SSOT D.7 #4: factor lives until the first new meaningful signal.
 * A "meaningful signal" is:
 *   - a completed check-in with text (source: check_in_text, reflection,
 *     journal), OR
 *   - an explicit confirmation in the memory screen (signal
 *     `yes_that_fits`, any memory_screen declaration).
 *
 * Returns true if the given incoming signal clears the recalibration
 * flag. The caller is responsible for persisting the clear.
 */
export function clearsRecalibration(options: {
  signal_id?: SignalId;
  source_type?: SourceType;
  completed_checkin_with_text?: boolean;
}): boolean {
  if (options.completed_checkin_with_text) return true;

  if (
    options.source_type === "check_in_text" ||
    options.source_type === "reflection" ||
    options.source_type === "journal"
  ) {
    return true;
  }

  if (options.signal_id === "yes_that_fits") return true;
  if (
    options.source_type === "memory_screen" &&
    options.signal_id === "onboarding_direct_answer"
  ) {
    // Defensive: declarations through memory screen also clear.
    return true;
  }

  return false;
}

/**
 * SSOT D.7 (UI tone):
 *   `[COPY]` It's been a bit. Want to check in briefly, or jump into
 *   something short?
 *
 *   Memory screen soft banner:
 *   `Some of what I noticed may be outdated. Feel free to tell me what
 *   still fits.`
 *
 * Copy constants are kept in this module so the UI hooks in EPIC 3+ can
 * import them verbatim rather than re-typing the SSOT text.
 */
export const RECALIBRATION_COPY = {
  return_prompt:
    "It's been a bit. Want to check in briefly, or jump into something short?",
  memory_screen_banner:
    "Some of what I noticed may be outdated. Feel free to tell me what still fits.",
} as const;
