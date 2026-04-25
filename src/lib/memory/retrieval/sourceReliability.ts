/**
 * Source reliability mapping used by the universal relevance formula
 * (SSOT E.6.1 — `source_reliability(item.source_type)`).
 *
 * SSOT lists source_type values in D.3 (item schema) and gives signal
 * priorities in D.5.1, but does not enumerate numeric reliability per
 * source_type. We derive a canonical mapping aligned with D.5.1:
 *
 *   declaration-carrying sources (onboarding, memory_screen) = 1.00
 *   explicit session signals (check_in_text, trigger_tags,
 *     reflection)                                           = 0.80
 *   structured elicitation (self_discovery)                  = 0.75
 *   behavioural signals (practice_feedback, journal)         = 0.60
 *   pattern detection (inferred by system)                   = 0.45
 *   resonance-only signals (echo_save)                       = 0.25
 *
 * Values preserve the SSOT ordering: declaration > corroboration >
 * resonance. They live here so the relevance formula has a single
 * reference; tune together with `SIGNAL_RELIABILITY` in constants.ts.
 */

import type { SourceType } from "../types";

export const SOURCE_TYPE_RELIABILITY: Record<SourceType, number> = {
  onboarding: 1.0,
  memory_screen: 1.0,
  check_in_text: 0.8,
  trigger_tags: 0.8,
  reflection: 0.8,
  self_discovery: 0.75,
  practice_feedback: 0.6,
  journal: 0.6,
  pattern_detection: 0.45,
  echo_save: 0.25,
};
