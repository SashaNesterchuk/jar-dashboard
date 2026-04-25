/**
 * Stable profile recompute — SSOT D.8.
 *
 * `stable_profile` is a derived representation over memory items
 * (SSOT D.8.2) with three update tiers:
 *
 *   - sync (on memory item update)         → basics, declared,
 *                                              current_constraints
 *   - async (hourly enrichment job)        → what_tends_to_help,
 *                                              confidence computation,
 *                                              activity_snapshot
 *   - on_demand (on retrieval)             → active_hypotheses,
 *                                              confirmed_insights subset
 *
 * This module is PURE: it takes items, a daily snapshot, confidence
 * inputs, and a `now` Date, and returns a new profile. Callers decide
 * when and how to persist it through `StorageAdapter.upsertStableProfile`.
 */

import {
  ACTIVE_CONFIDENCE_INSIGHT_MIN,
  ACTIVE_CONFIDENCE_RETRIEVAL_MIN,
} from "../constants";
import { recomputeActiveConfidence } from "../retrieval/relevance";
import {
  computeUserConfidenceScore,
  resolveConfidenceLevel,
} from "../state/confidence";
import type {
  ConfidenceScoreInputs,
  DailySnapshot,
  MemoryItem,
  StableProfile,
  StableProfileActivitySnapshot,
  StableProfileBasics,
  StableProfileCurrentConstraints,
  StableProfileDeclared,
  StableProfileHelpEntry,
  StableProfileHypothesisEntry,
} from "../types";

export type StableProfileMode = "sync" | "async" | "on_demand" | "full";

export interface RecomputeStableProfileParams {
  existing: StableProfile | null;
  userId: string;
  items: readonly MemoryItem[];
  /** Most recent daily snapshot; used for activity_snapshot fallback. */
  dailySnapshot: DailySnapshot | null;
  /** Pre-aggregated confidence inputs (SSOT D.4.1). */
  confidenceInputs: ConfidenceScoreInputs;
  /**
   * Optional `what_tends_to_help` aggregation produced by the async
   * enrichment job. Profile recompute does not derive this in-module;
   * we accept it as a pre-computed list so the pipeline stays pure.
   */
  whatTendsToHelp?: readonly StableProfileHelpEntry[];
  now: Date;
  mode?: StableProfileMode;
}

const DEFAULT_BASICS: StableProfileBasics = {
  name: null,
  locale: null,
  sign_up_date: null,
};

const DEFAULT_DECLARED: StableProfileDeclared = {
  primary_motivation: [],
  top_value: null,
  focus_areas: [],
  support_style: null,
  realistic_action_modes: [],
  daily_time_budget: null,
  support_timing_preference: null,
};

const DEFAULT_ACTIVITY: StableProfileActivitySnapshot = {
  total_sessions: 0,
  days_active_in_last_14: 0,
  text_sessions_ratio: 0,
  streak_status: "none",
};

function uniq<T>(xs: readonly T[]): T[] {
  return Array.from(new Set(xs));
}

/**
 * SSOT D.8.2 — sync slice: basics + declared + current_constraints.
 *
 * Mapping semantics (deliberately conservative, per SSOT under-
 * specification; tune with P0b onboarding feedback):
 *
 *   - basics              → carried from `existing` unless an item of
 *                           type `immutable_fact` with
 *                           `content.domain === "identity"` overrides.
 *                           Today we treat immutable_fact with tag
 *                           `name`/`locale` as a source of truth; other
 *                           identity facts are passed through.
 *   - declared            → union of theme_tags and focus_areas across
 *                           `declared_preference` items (drives
 *                           `focus_areas`). Other fields (top_value,
 *                           support_style, …) are copied from
 *                           `existing`; they flow from onboarding
 *                           specifically and are written by EPIC 7.
 *   - current_constraints → `temporary_constraint` items with negative
 *                           polarity feed `pain_map`; items with
 *                           `sensitivity_level === "avoided_adjacent"`
 *                           feed `avoided_topics`; current life
 *                           context entries come from
 *                           `temporary_constraint` items with a set
 *                           `content.domain === "context"`.
 */
export function recomputeSyncSlices(
  existing: StableProfile | null,
  items: readonly MemoryItem[],
): Pick<StableProfile, "basics" | "declared" | "current_constraints"> {
  const basics = deriveBasics(existing, items);
  const declared = deriveDeclared(existing, items);
  const current_constraints = deriveConstraints(items);
  return { basics, declared, current_constraints };
}

function deriveBasics(
  existing: StableProfile | null,
  items: readonly MemoryItem[],
): StableProfileBasics {
  const base = existing?.basics ?? DEFAULT_BASICS;
  let name = base.name;
  let locale = base.locale;

  for (const item of items) {
    if (item.type !== "immutable_fact") continue;
    if (item.status !== "active") continue;
    if (item.content.domain !== "identity") continue;
    if (item.theme_tags.includes("name") && item.content.claim) {
      name = item.content.claim;
    }
    if (item.theme_tags.includes("locale") && item.content.claim) {
      locale = item.content.claim;
    }
  }
  return { ...base, name, locale };
}

function deriveDeclared(
  existing: StableProfile | null,
  items: readonly MemoryItem[],
): StableProfileDeclared {
  const base = existing?.declared ?? DEFAULT_DECLARED;
  const focusTags = new Set<string>(base.focus_areas);

  for (const item of items) {
    if (item.type !== "declared_preference") continue;
    if (item.status !== "active") continue;
    item.related_focus_areas.forEach((f) => focusTags.add(f));
  }

  return { ...base, focus_areas: Array.from(focusTags) };
}

function deriveConstraints(
  items: readonly MemoryItem[],
): StableProfileCurrentConstraints {
  const pain: string[] = [];
  const avoided: string[] = [];
  const context: StableProfileCurrentConstraints["current_life_context"] = [];

  for (const item of items) {
    if (item.status !== "active") continue;

    if (
      item.type === "temporary_constraint" &&
      item.content.polarity === "negative"
    ) {
      pain.push(item.content.claim);
      if (item.content.domain === "context") {
        context.push({
          topic: item.content.claim,
          active_until: null,
        });
      }
    }

    if (item.sensitivity_level === "avoided_adjacent") {
      avoided.push(...item.theme_tags);
    }
  }

  return {
    pain_map: uniq(pain),
    avoided_topics: uniq(avoided),
    current_life_context: dedupeContext(context),
  };
}

function dedupeContext(
  entries: readonly {
    topic: string;
    active_until: string | null;
  }[],
): StableProfileCurrentConstraints["current_life_context"] {
  const seen = new Map<string, { topic: string; active_until: string | null }>();
  for (const e of entries) {
    if (!seen.has(e.topic)) seen.set(e.topic, e);
  }
  return Array.from(seen.values());
}

/**
 * SSOT D.8.2 — async slice: what_tends_to_help + confidence +
 * activity_snapshot.
 */
export function recomputeAsyncSlices(
  existing: StableProfile | null,
  confidenceInputs: ConfidenceScoreInputs,
  snapshot: DailySnapshot | null,
  whatTendsToHelp?: readonly StableProfileHelpEntry[],
): Pick<
  StableProfile,
  | "what_tends_to_help"
  | "user_confidence_score"
  | "confidence_level"
  | "activity_snapshot"
> {
  const score = computeUserConfidenceScore(confidenceInputs);
  const level = resolveConfidenceLevel(score, confidenceInputs);
  const activity = deriveActivitySnapshot(
    existing?.activity_snapshot ?? DEFAULT_ACTIVITY,
    confidenceInputs,
    snapshot,
  );

  return {
    what_tends_to_help: (whatTendsToHelp
      ? [...whatTendsToHelp]
      : existing?.what_tends_to_help) ?? [],
    user_confidence_score: score,
    confidence_level: level,
    activity_snapshot: activity,
  };
}

function deriveActivitySnapshot(
  existing: StableProfileActivitySnapshot,
  confidenceInputs: ConfidenceScoreInputs,
  snapshot: DailySnapshot | null,
): StableProfileActivitySnapshot {
  return {
    total_sessions: confidenceInputs.total_sessions,
    days_active_in_last_14: confidenceInputs.days_active_in_last_14,
    text_sessions_ratio: confidenceInputs.text_sessions_ratio,
    streak_status: snapshot?.streak_status ?? existing.streak_status,
  };
}

/**
 * SSOT D.8.2 — on-demand slice: active_hypotheses + confirmed_insights.
 *
 * `active_confidence` is recomputed from `confidence * freshness_score`
 * with the current clock (SSOT D.4.3). We never trust the item's cached
 * `active_confidence` column during retrieval-time slicing.
 */
export function recomputeOnDemandSlices(
  items: readonly MemoryItem[],
  now: Date,
): Pick<StableProfile, "active_hypotheses" | "confirmed_insights"> {
  const hypotheses: StableProfileHypothesisEntry[] = [];
  const insights: StableProfileHypothesisEntry[] = [];

  for (const item of items) {
    if (item.status !== "active") continue;
    const ac = recomputeActiveConfidence(item, now);

    const entry: StableProfileHypothesisEntry = {
      id: item.id,
      statement: item.statement_user_facing ?? item.statement_internal,
      confidence: ac,
      theme: item.theme_tags[0] ?? "",
    };

    if (item.type === "hypothesis" && ac >= ACTIVE_CONFIDENCE_RETRIEVAL_MIN) {
      hypotheses.push(entry);
    } else if (
      item.type === "confirmed_insight" &&
      ac >= ACTIVE_CONFIDENCE_INSIGHT_MIN
    ) {
      insights.push(entry);
    }
  }

  hypotheses.sort((a, b) => b.confidence - a.confidence);
  insights.sort((a, b) => b.confidence - a.confidence);

  return {
    active_hypotheses: hypotheses,
    confirmed_insights: insights,
  };
}

/**
 * Orchestrator that rebuilds the full profile. The `mode` argument
 * matches SSOT D.8.2 vocabulary:
 *   - "sync"       → only sync slices rebuilt; other slices carried
 *                     from `existing` (or defaulted if none).
 *   - "async"      → only async slices rebuilt.
 *   - "on_demand"  → only on_demand slices rebuilt.
 *   - "full"       → every slice rebuilt.
 */
export function recomputeStableProfile(
  params: RecomputeStableProfileParams,
): StableProfile {
  const mode = params.mode ?? "full";
  const existing = params.existing;

  const base: StableProfile = existing
    ? { ...existing }
    : emptyProfile(params.userId);

  if (mode === "sync" || mode === "full") {
    const sync = recomputeSyncSlices(existing, params.items);
    base.basics = sync.basics;
    base.declared = sync.declared;
    base.current_constraints = sync.current_constraints;
  }

  if (mode === "async" || mode === "full") {
    const async_ = recomputeAsyncSlices(
      existing,
      params.confidenceInputs,
      params.dailySnapshot,
      params.whatTendsToHelp,
    );
    base.what_tends_to_help = async_.what_tends_to_help;
    base.user_confidence_score = async_.user_confidence_score;
    base.confidence_level = async_.confidence_level;
    base.activity_snapshot = async_.activity_snapshot;
  }

  if (mode === "on_demand" || mode === "full") {
    const od = recomputeOnDemandSlices(params.items, params.now);
    base.active_hypotheses = od.active_hypotheses;
    base.confirmed_insights = od.confirmed_insights;
  }

  base.user_id = params.userId;
  base.last_refreshed_at = params.now.toISOString();
  return base;
}

function emptyProfile(userId: string): StableProfile {
  return {
    user_id: userId,
    basics: { ...DEFAULT_BASICS },
    declared: { ...DEFAULT_DECLARED },
    current_constraints: {
      pain_map: [],
      avoided_topics: [],
      current_life_context: [],
    },
    what_tends_to_help: [],
    active_hypotheses: [],
    confirmed_insights: [],
    confidence_level: "A",
    user_confidence_score: 0,
    last_refreshed_at: new Date(0).toISOString(),
    activity_snapshot: { ...DEFAULT_ACTIVITY },
  };
}
