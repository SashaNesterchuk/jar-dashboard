/**
 * Pattern detection — observation → hypothesis (SSOT D.2.2).
 *
 * Given a batch of `observation`-type memory items, this module:
 *   1. Groups them by theme tag.
 *   2. Feeds each group into `evaluateObservationToHypothesis`.
 *   3. Returns a list of themes where the threshold is met (≥3
 *      consistent observations in 14d with avg signal_strength ≥ 0.4).
 *
 * No mutation happens here. `itemUpsert` / `feedback/apply.ts` own the
 * actual item creation. This keeps the detector pure and unit-testable.
 */

import type { MemoryItem } from "../types";
import {
  evaluateObservationToHypothesis,
  type ObservationFact,
  type TransitionVerdict,
} from "../state/transitions";

export interface PatternDetectionResult {
  theme_tag: string;
  observation_ids: string[];
  verdict: TransitionVerdict<{
    matched: number;
    avg_signal_strength: number;
    window_days: number;
  }>;
}

export interface DetectPatternsParams {
  /** All active observation-type items for the user. */
  observations: readonly MemoryItem[];
  now: Date;
}

/**
 * Best-effort recovery of `signal_strength` from an observation:
 * we stored per-source weights in `MemoryItemSource.weight`, so we
 * take the strongest one as the observation's signal_strength proxy.
 * SSOT D.2.2 formula values are computed at ingestion time and saved
 * onto the item's source; this function just surfaces them.
 */
function observationToFact(item: MemoryItem, themeTag: string): ObservationFact {
  const strongest = item.sources.reduce(
    (max, s) => (s.weight > max ? s.weight : max),
    0,
  );
  return {
    id: item.id,
    theme_tag: themeTag,
    signal_strength: strongest > 0 ? strongest : item.confidence,
    timestamp: new Date(item.last_supported_at),
  };
}

export function detectObservationToHypothesisPatterns(
  params: DetectPatternsParams,
): PatternDetectionResult[] {
  const byTheme = new Map<string, MemoryItem[]>();
  for (const item of params.observations) {
    if (item.type !== "observation" || item.status !== "active") continue;
    for (const tag of item.theme_tags) {
      const bucket = byTheme.get(tag) ?? [];
      bucket.push(item);
      byTheme.set(tag, bucket);
    }
  }

  const results: PatternDetectionResult[] = [];
  for (const [theme, items] of byTheme.entries()) {
    const facts = items.map((i) => observationToFact(i, theme));
    const verdict = evaluateObservationToHypothesis(facts, theme, params.now);
    results.push({
      theme_tag: theme,
      observation_ids: items.map((i) => i.id),
      verdict,
    });
  }

  return results;
}

export function eligiblePatterns(
  results: readonly PatternDetectionResult[],
): PatternDetectionResult[] {
  return results.filter((r) => r.verdict.eligible);
}
