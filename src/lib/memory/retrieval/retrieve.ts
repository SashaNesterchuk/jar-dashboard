/**
 * Retrieval pipeline — SSOT E.6.
 *
 * Glue between storage (adapter) and pure relevance / rules:
 *
 *   1. Load candidates from StorageAdapter.
 *   2. Apply per-surface policy gate (SSOT E.6.3, D.3.2 sensitive).
 *   3. Recompute `active_confidence` (SSOT D.4.3 — ALWAYS on retrieval;
 *      the cached column on the item is ignored, only filled in audit).
 *   4. Drop items below the surface's `min_active_confidence`.
 *   5. Rank by relevance (SSOT E.6.1).
 *   6. Resolve contradictions pair-wise (SSOT E.6.4): source-of-truth
 *      rules (D.2.3) → loser dropped; mutual unresolved → emit
 *      `memory.retrieval_contradiction` telemetry.
 *   7. Take top-N by surface budget.
 *   8. Compute `sum(active_confidence)`; if below
 *      LOW_CONFIDENCE_SUM_THRESHOLD, flag low-confidence fallback
 *      (SSOT E.6.5).
 *
 * The module is PURE TypeScript except for the `StorageAdapter` /
 * `ClockAdapter` / `TelemetryAdapter` inputs — all three come through
 * the adapter surface, so this function ports to RN unchanged.
 */

import { LOW_CONFIDENCE_SUM_THRESHOLD } from "../constants";
import {
  makeRetrievalContradictionEvent,
  resolveConflict,
  type ConflictResolution,
  type RetrievalContradictionEvent,
} from "../state/conflict";
import type { ClockAdapter, StorageAdapter, TelemetryAdapter } from "../adapters";
import type { MemoryItem, SessionSummaryV1Sync } from "../types";
import {
  recomputeActiveConfidence,
  relevanceScore,
  type RelevanceBreakdown,
  type RetrievalIntent,
} from "./relevance";
import {
  surfacePolicyReject,
  SURFACE_RULES,
  type RetrievalSurface,
  type SurfaceRejectReason,
} from "./surfaceRules";

export interface RetrieveParams {
  userId: string;
  surface: RetrievalSurface;
  intent: RetrievalIntent;
  storage: StorageAdapter;
  clock: ClockAdapter;
  telemetry?: TelemetryAdapter;
}

export interface RetrievedItem {
  item: MemoryItem;
  score: RelevanceBreakdown;
}

export interface ExcludedItem {
  item: MemoryItem;
  reason:
    | SurfaceRejectReason
    | { kind: "active_confidence"; reason: string }
    | { kind: "conflict"; reason: string; rule: string; winner_id: string }
    | { kind: "budget"; reason: string };
}

export interface RetrieveResult {
  surface: RetrievalSurface;
  selected: RetrievedItem[];
  summaries: SessionSummaryV1Sync[];
  excluded: ExcludedItem[];
  contradictions: RetrievalContradictionEvent[];
  low_confidence_fallback: boolean;
  sum_active_confidence: number;
}

export async function retrieve(
  params: RetrieveParams,
): Promise<RetrieveResult> {
  const rules = SURFACE_RULES[params.surface];
  const now = params.clock.now();

  const candidates = await params.storage.getMemoryItems(params.userId);
  const summaries = await params.storage.getRecentSessionSummaries(
    params.userId,
    rules.budget.summaries,
  );

  const excluded: ExcludedItem[] = [];

  // 1) Policy gate.
  const policyPassed: MemoryItem[] = [];
  for (const item of candidates) {
    const reject = surfacePolicyReject(rules, item, {
      session_mentioned_topics: params.intent.session_mentioned_topics ?? [],
    });
    if (reject) excluded.push({ item, reason: reject });
    else policyPassed.push(item);
  }

  // 2) Recompute active_confidence; drop below-threshold.
  //    Always recomputed at retrieval (SSOT D.4.3).
  const abovethreshold: MemoryItem[] = [];
  for (const item of policyPassed) {
    const ac = recomputeActiveConfidence(item, now);
    if (ac < rules.min_active_confidence) {
      excluded.push({
        item,
        reason: {
          kind: "active_confidence",
          reason: `active_confidence=${ac.toFixed(3)} < min=${rules.min_active_confidence}`,
        },
      });
      continue;
    }
    abovethreshold.push(item);
  }

  // 3) Rank all survivors by relevance (no diversity bonus yet —
  //    diversity is computed against the already-selected set).
  const ranked = abovethreshold
    .map((item) => ({
      item,
      base: relevanceScore(item, params.intent, [], now),
    }))
    .sort((a, b) => b.base.total - a.base.total);

  // 4) Resolve contradictions pair-wise among ranked items BEFORE
  //    applying the budget. We do it here (not after budget cut) so
  //    that dropping a loser does not leave us under-budget with a
  //    known-bad item leaked in.
  const contradictions: RetrievalContradictionEvent[] = [];
  const droppedByConflict = new Set<string>();

  if (rules.exclude_contradictory || params.surface !== "memory_screen") {
    for (let i = 0; i < ranked.length; i += 1) {
      if (droppedByConflict.has(ranked[i].item.id)) continue;
      for (let j = i + 1; j < ranked.length; j += 1) {
        if (droppedByConflict.has(ranked[j].item.id)) continue;
        if (!areContradicting(ranked[i].item, ranked[j].item)) continue;

        const resolution = resolveConflict(ranked[i].item, ranked[j].item);
        const { loserId, winnerId } = mapResolution(
          resolution,
          ranked[i].item,
          ranked[j].item,
        );

        if (loserId) {
          droppedByConflict.add(loserId);
          const loserItem = loserId === ranked[i].item.id
            ? ranked[i].item
            : ranked[j].item;
          excluded.push({
            item: loserItem,
            reason: {
              kind: "conflict",
              reason: resolution.reason,
              rule: resolution.rule,
              winner_id: winnerId ?? "none",
            },
          });
        }

        const evt = makeRetrievalContradictionEvent(
          ranked[i].item,
          ranked[j].item,
          resolution,
          now,
        );
        if (evt) {
          contradictions.push(evt);
          params.telemetry?.capture("memory.retrieval_contradiction", {
            item_a_id: evt.item_a_id,
            item_b_id: evt.item_b_id,
            rule: evt.rule,
            reason: evt.reason,
            surface: params.surface,
          });
        }
      }
    }
  }

  // 5) Apply budget. Recompute diversity bonus relative to the already
  //    selected set so later picks get a freshness/theme-novelty
  //    nudge (SSOT E.6.1).
  const survivors = ranked
    .filter((r) => !droppedByConflict.has(r.item.id))
    .map((r) => r.item);

  const selected: RetrievedItem[] = [];
  for (const item of survivors) {
    if (selected.length >= rules.budget.items) {
      excluded.push({
        item,
        reason: {
          kind: "budget",
          reason: `budget_items=${rules.budget.items} reached`,
        },
      });
      continue;
    }
    const score = relevanceScore(
      item,
      params.intent,
      selected.map((s) => s.item),
      now,
    );
    selected.push({ item, score });
  }

  // Re-sort selected by total score so downstream consumers can trust
  // the order (selection order is stable after the first pass, but
  // diversity may shuffle marginally).
  selected.sort((a, b) => b.score.total - a.score.total);

  // 6) Low-confidence fallback (SSOT E.6.5).
  const sumActive = selected.reduce(
    (acc, r) => acc + r.score.active_confidence,
    0,
  );
  const lowConfidenceFallback = sumActive < LOW_CONFIDENCE_SUM_THRESHOLD;

  return {
    surface: params.surface,
    selected,
    summaries,
    excluded,
    contradictions,
    low_confidence_fallback: lowConfidenceFallback,
    sum_active_confidence: sumActive,
  };
}

/**
 * Contradiction detection heuristic — SSOT E.6.4 leaves the rule
 * under-specified ("two items with logical contradiction"). In P0 we
 * use a minimal, explainable definition:
 *
 *   - At least one shared theme_tag, AND
 *   - Polarity is strictly opposite (positive ↔ negative; `mixed`
 *     and `neutral` do not trigger).
 *
 * This deliberately avoids NLP equivalence detection — that lands in
 * P1. Items that trigger false positives here are re-ranked by
 * `resolveConflict`, whose rules are canonical.
 */
export function areContradicting(a: MemoryItem, b: MemoryItem): boolean {
  if (a.id === b.id) return false;

  const themeOverlap = a.theme_tags.some((t) => b.theme_tags.includes(t));
  if (!themeOverlap) return false;

  const pa = a.content.polarity;
  const pb = b.content.polarity;
  return (
    (pa === "positive" && pb === "negative") ||
    (pa === "negative" && pb === "positive")
  );
}

function mapResolution(
  resolution: ConflictResolution,
  a: MemoryItem,
  b: MemoryItem,
): { loserId: string | null; winnerId: string | null } {
  if (resolution.winner === "a" && resolution.loser === "b") {
    return { loserId: b.id, winnerId: a.id };
  }
  if (resolution.winner === "b" && resolution.loser === "a") {
    return { loserId: a.id, winnerId: b.id };
  }
  // "mutual" or special resolutions (e.g. triggers_re_check) — no
  // single loser; leave both in the pool, telemetry captured above.
  return { loserId: null, winnerId: null };
}

export type { RetrievalIntent } from "./relevance";
export type { RetrievalSurface, SurfaceRules } from "./surfaceRules";
export { SURFACE_RULES } from "./surfaceRules";
