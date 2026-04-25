/**
 * Pure projection of memory items into the four Memory-screen blocks
 * (`Your Personalization`) — SSOT C.3.2 + C.3.3.
 *
 * Inputs: all active items for a user + current time.
 * Output: four buckets (basics / helps / patterns / boundaries) plus
 * per-item visual presentation metadata (softener + opacity label +
 * user-facing label per confidence level) derived strictly from
 * SSOT C.3.3 and D.4.3 thresholds.
 *
 * Guardrails:
 *   - Items with `confidence < 0.4` or `visibility_scope === "hidden"`
 *     are excluded (SSOT C.3.3 "Заборонено показувати").
 *   - `removed_by_user`, `stale`, `re_check` are excluded from the
 *     block projection (they surface only in the debug view).
 *   - No raw score / diagnostic labels are emitted here.
 *
 * Pure — no React, no adapters. Safe to port to `jar/` as-is.
 */

import { ACTIVE_CONFIDENCE_NO_SOFTENER } from "../constants";
import { recomputeActiveConfidence } from "../retrieval/relevance";
import type { MemoryItem } from "../types";

export type MemoryCardTier = "confirmed" | "hypothesis" | "observation";

export interface MemoryCardProjection {
  item: MemoryItem;
  tier: MemoryCardTier;
  /** Softener prefix per SSOT C.3.3; `null` for confirmed items. */
  softener: string | null;
  /** Plain-English tier label shown to the user (SSOT C.3.3 / C.3.5). */
  tier_label: string;
  /** 1.0 for confirmed, 0.8 for hypothesis/observation (SSOT C.3.3). */
  opacity: number;
  /** `active_confidence` at projection time — used only for ordering. */
  active_confidence: number;
}

export interface MemoryScreenView {
  /** Block 1 — SSOT C.3.2: name, motivation, focus_areas, support_style + boundaries. */
  basics: {
    facts: MemoryCardProjection[];
    declared_preferences: MemoryCardProjection[];
  };
  /** Block 1 "Your boundaries" — SSOT F.2.3. */
  boundaries: MemoryCardProjection[];
  /** Block 2 — SSOT C.3.2 "What tends to help". */
  helps: MemoryCardProjection[];
  /** Block 3 — SSOT C.3.2 "Patterns I'm noticing". */
  patterns: MemoryCardProjection[];
  /** Items excluded from render so UI can surface a count/explanation. */
  hidden_count: number;
}

export interface ProjectMemoryScreenParams {
  items: readonly MemoryItem[];
  now: Date;
}

const MIN_VISIBLE_CONFIDENCE = 0.4; // SSOT C.3.3 (Заборонено sub < 0.4).

const SOFTENER_BY_TIER: Record<MemoryCardTier, string | null> = {
  confirmed: null,
  hypothesis: "It seems",
  observation: "I'm noticing",
};

const TIER_LABEL: Record<MemoryCardTier, string> = {
  confirmed: "",
  hypothesis: "Possibly",
  observation: "Recent pattern",
};

export function projectMemoryScreen(
  params: ProjectMemoryScreenParams,
): MemoryScreenView {
  const basicsFacts: MemoryCardProjection[] = [];
  const basicsPrefs: MemoryCardProjection[] = [];
  const boundaries: MemoryCardProjection[] = [];
  const helps: MemoryCardProjection[] = [];
  const patterns: MemoryCardProjection[] = [];
  let hidden = 0;

  for (const raw of params.items) {
    if (!isVisible(raw)) {
      hidden += 1;
      continue;
    }
    const active_confidence = recomputeActiveConfidence(raw, params.now);
    const tier = tierFor(raw);
    const projection: MemoryCardProjection = {
      item: raw,
      tier,
      softener: SOFTENER_BY_TIER[tier],
      tier_label: TIER_LABEL[tier],
      opacity: presentationOpacity(tier, active_confidence),
      active_confidence,
    };

    switch (raw.type) {
      case "immutable_fact":
        basicsFacts.push(projection);
        break;
      case "declared_preference":
      case "temporary_constraint":
        basicsPrefs.push(projection);
        break;
      case "declared_boundary":
        boundaries.push(projection);
        break;
      case "confirmed_insight":
        helps.push(projection);
        break;
      case "hypothesis":
        helps.push(projection);
        break;
      case "observation":
        patterns.push(projection);
        break;
    }
  }

  // Sort each block by active_confidence desc so strongest items lead.
  const byConfDesc = (a: MemoryCardProjection, b: MemoryCardProjection) =>
    b.active_confidence - a.active_confidence;
  basicsFacts.sort(byConfDesc);
  basicsPrefs.sort(byConfDesc);
  boundaries.sort(byConfDesc);
  helps.sort(byConfDesc);
  patterns.sort(byConfDesc);

  return {
    basics: { facts: basicsFacts, declared_preferences: basicsPrefs },
    boundaries,
    helps,
    patterns,
    hidden_count: hidden,
  };
}

/* ---------------------------------------------------------------- helpers */

function isVisible(item: MemoryItem): boolean {
  if (item.status !== "active") return false;
  if (item.visibility_scope === "hidden") return false;
  if (item.visibility_scope !== "memory_screen" &&
      item.visibility_scope !== "summary" &&
      item.visibility_scope !== "plan_context") {
    return false;
  }
  if (item.type === "immutable_fact" || item.type === "declared_preference" ||
      item.type === "declared_boundary" || item.type === "temporary_constraint") {
    // Declared items are always visible regardless of confidence.
    return true;
  }
  return item.confidence >= MIN_VISIBLE_CONFIDENCE;
}

function tierFor(item: MemoryItem): MemoryCardTier {
  switch (item.type) {
    case "confirmed_insight":
      return "confirmed";
    case "hypothesis":
      return "hypothesis";
    case "observation":
      return "observation";
    // Declared / facts render without softener — treat as "confirmed".
    case "immutable_fact":
    case "declared_preference":
    case "declared_boundary":
    case "temporary_constraint":
      return "confirmed";
  }
}

function presentationOpacity(tier: MemoryCardTier, active: number): number {
  if (tier === "confirmed") return 1;
  // SSOT C.3.3: hypothesis/observation render at ~0.8 opacity.
  // Active_confidence ≥ NO_SOFTENER threshold may bump back to 0.9 for
  // readability but never above confirmed-level 1.0.
  if (active >= ACTIVE_CONFIDENCE_NO_SOFTENER) return 0.9;
  return 0.8;
}
