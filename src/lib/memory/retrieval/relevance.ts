/**
 * Universal relevance formula — SSOT E.6.1.
 *
 *   relevance_score(item, intent) =
 *       0.35 * active_confidence(item)
 *     + 0.25 * intent_match_score(item, intent)
 *     + 0.20 * recency_score(item)
 *     + 0.15 * source_reliability(item.source_type)
 *     + 0.05 * diversity_bonus(item, already_selected)
 *
 * `intent_match_score` is cosine similarity between `item.theme_tags`
 * and `intent.theme_tags`, with a bonus for `related_focus_areas`
 * matches.
 *
 * All functions here are PURE: they take `now: Date` from the caller
 * (ClockAdapter) so decay and recency are deterministic in tests. The
 * item's `active_confidence` is always recomputed from
 * `confidence * freshness_score` on the spot — cached values are
 * ignored (SSOT D.4.3).
 */

import { RELEVANCE_WEIGHTS } from "../constants";
import { computeActiveConfidence } from "../state/confidence";
import { daysBetween, freshnessScore } from "../state/decay";
import type { MemoryItem } from "../types";
import { SOURCE_TYPE_RELIABILITY } from "./sourceReliability";

/**
 * Caller-provided description of the retrieval intent. Memory layer
 * never invents `theme_tags` — these come from the session/surface
 * context (SSOT E.6.3 — per-surface rules).
 */
export interface RetrievalIntent {
  theme_tags: readonly string[];
  focus_areas?: readonly string[];
  /**
   * Topics the user has mentioned in the current session. Items with
   * `sensitivity_level === "sensitive"` are suppressed unless one of
   * their theme_tags or related_focus_areas intersects this set
   * (SSOT D.3.2).
   */
  session_mentioned_topics?: readonly string[];
}

export interface RelevanceBreakdown {
  active_confidence: number;
  intent_match_score: number;
  recency_score: number;
  source_reliability: number;
  diversity_bonus: number;
  total: number;
}

function clamp(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo;
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

function unique<T>(xs: readonly T[]): T[] {
  return Array.from(new Set(xs));
}

function cosineSimilarityBag(
  a: readonly string[],
  b: readonly string[],
): number {
  if (a.length === 0 || b.length === 0) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  let inter = 0;
  aSet.forEach((t) => {
    if (bSet.has(t)) inter += 1;
  });
  const denom = Math.sqrt(aSet.size) * Math.sqrt(bSet.size);
  return denom === 0 ? 0 : inter / denom;
}

/**
 * SSOT E.6.1 — intent_match_score as cosine similarity of theme_tags
 * with a bonus for related_focus_areas overlap.
 *
 * The formula leaves the bonus shape under-specified; we use a soft
 * additive bonus that caps at 1:
 *
 *   raw = cosine(theme_tags, intent.theme_tags)
 *       + 0.25 * (focus_overlap / max(1, |intent.focus_areas|))
 *   intent_match_score = clamp(raw, 0, 1)
 *
 * The 0.25 coefficient is the upper bound a single focus-area match
 * can contribute — it keeps the boost meaningful but below a full
 * theme_tag match. It lives here (not in `constants.ts`) because SSOT
 * does not fix it; treat as tunable inside relevance.
 */
export function intentMatchScore(
  item: MemoryItem,
  intent: RetrievalIntent,
): number {
  const cos = cosineSimilarityBag(item.theme_tags, intent.theme_tags);

  const intentFocus = intent.focus_areas ?? [];
  let focusBonus = 0;
  if (intentFocus.length > 0 && item.related_focus_areas.length > 0) {
    const itemFocus = new Set(item.related_focus_areas);
    let overlap = 0;
    intentFocus.forEach((f) => {
      if (itemFocus.has(f)) overlap += 1;
    });
    focusBonus = 0.25 * (overlap / Math.max(1, intentFocus.length));
  }
  return clamp(cos + focusBonus, 0, 1);
}

/**
 * SSOT E.6.1 — recency_score: freshly supported items outrank stale
 * ones. The SSOT does not give a formula; we reuse the decay half-life
 * from D.4.4 with a faster floor so recency is independent of the
 * item's own decay profile. Specifically we apply an exponential
 * decay with a fixed 14-day half-life so an item supported today
 * scores 1.0, supported a fortnight ago scores 0.5, supported a month
 * ago ~0.25. This keeps the function monotonic and bounded in [0, 1].
 */
const RECENCY_HALF_LIFE_DAYS = 14;
const LN2 = Math.log(2);

export function recencyScore(lastSupportedAt: Date, now: Date): number {
  const days = Math.max(0, daysBetween(lastSupportedAt, now));
  if (days === 0) return 1;
  const v = Math.exp((-LN2 * days) / RECENCY_HALF_LIFE_DAYS);
  return clamp(v, 0, 1);
}

/**
 * SSOT E.6.1 — source_reliability(item.source_type).
 *
 * Items in the canonical schema carry `sources: MemoryItemSource[]`
 * (SSOT D.3, §1443–1452), so "item.source_type" is under-specified.
 * We pick the highest-weight source, ties broken by most recent
 * timestamp, and look up its source_type in `SOURCE_TYPE_RELIABILITY`.
 * If an item has no sources, fall back to the neutral midpoint 0.5.
 */
export function sourceReliability(item: MemoryItem): number {
  if (item.sources.length === 0) return 0.5;
  let pick = item.sources[0];
  for (const s of item.sources) {
    if (s.weight > pick.weight) {
      pick = s;
    } else if (
      s.weight === pick.weight &&
      new Date(s.timestamp).getTime() > new Date(pick.timestamp).getTime()
    ) {
      pick = s;
    }
  }
  return SOURCE_TYPE_RELIABILITY[pick.source_type] ?? 0.5;
}

/**
 * SSOT E.6.1 — diversity_bonus: encourages retrieving items that do
 * not duplicate themes already in the selected set. SSOT does not
 * give a formula; we use:
 *
 *   fraction_new_themes =
 *     |new_themes(item) \ themes(selected)| / max(1, |themes(item)|)
 *
 *   diversity_bonus = clamp(fraction_new_themes, 0, 1)
 *
 * Items with zero theme_tags return 0 (no information gain).
 */
export function diversityBonus(
  item: MemoryItem,
  alreadySelected: readonly MemoryItem[],
): number {
  if (item.theme_tags.length === 0) return 0;
  const taken = new Set<string>();
  alreadySelected.forEach((s) => s.theme_tags.forEach((t) => taken.add(t)));
  const itemTags = unique(item.theme_tags);
  const novel = itemTags.filter((t) => !taken.has(t)).length;
  return clamp(novel / itemTags.length, 0, 1);
}

/**
 * Compute `active_confidence` from the item's canonical fields.
 * Always recomputed on retrieval (SSOT D.4.3) — the `active_confidence`
 * column on the item is treated as a cache only.
 */
export function recomputeActiveConfidence(
  item: MemoryItem,
  now: Date,
): number {
  const fresh = freshnessScore(item.type, new Date(item.last_supported_at), now);
  return computeActiveConfidence(item.confidence, fresh);
}

export function relevanceScore(
  item: MemoryItem,
  intent: RetrievalIntent,
  alreadySelected: readonly MemoryItem[],
  now: Date,
): RelevanceBreakdown {
  const w = RELEVANCE_WEIGHTS;
  const ac = recomputeActiveConfidence(item, now);
  const im = intentMatchScore(item, intent);
  const rs = recencyScore(new Date(item.last_supported_at), now);
  const sr = sourceReliability(item);
  const db = diversityBonus(item, alreadySelected);

  const total =
    w.active_confidence * ac +
    w.intent_match_score * im +
    w.recency_score * rs +
    w.source_reliability * sr +
    w.diversity_bonus * db;

  return {
    active_confidence: ac,
    intent_match_score: im,
    recency_score: rs,
    source_reliability: sr,
    diversity_bonus: db,
    total: clamp(total, 0, 1),
  };
}
