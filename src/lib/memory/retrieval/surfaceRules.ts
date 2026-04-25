/**
 * Per-surface retrieval rules — SSOT E.6.2 (budgets) + E.6.3 (always /
 * never lists).
 *
 * These rules operate ON TOP of the universal relevance formula
 * (E.6.1). They model "who is even allowed in the pool" before
 * ranking, and for some surfaces bake in specific minimum
 * `active_confidence` thresholds (e.g. Smart Summary Level-C insights
 * require ≥ 0.5 per D.4.3).
 *
 * Pure module. Reads no external state.
 */

import {
  ACTIVE_CONFIDENCE_INSIGHT_MIN,
  ACTIVE_CONFIDENCE_RETRIEVAL_MIN,
  RETRIEVAL_BUDGET,
  type RetrievalBudget,
} from "../constants";
import type {
  MemoryItem,
  MemoryItemStatus,
  MemoryItemType,
  SensitivityLevel,
} from "../types";

export type RetrievalSurface = keyof typeof RETRIEVAL_BUDGET;

export interface SurfaceRules {
  readonly id: RetrievalSurface;
  readonly budget: RetrievalBudget;
  /** Minimum `active_confidence` for an item to pass the gate. */
  readonly min_active_confidence: number;
  /** Statuses allowed. Default: active + re_check. */
  readonly allowed_statuses: readonly MemoryItemStatus[];
  /**
   * If non-empty, item.type must be one of the listed types. Default
   * empty → any type allowed.
   */
  readonly allowed_types: readonly MemoryItemType[];
  /**
   * Sensitivity levels the surface can carry. Other items are dropped
   * up-front (pre-override). Override via `respect_session_mention`
   * below — SSOT D.3.2.
   */
  readonly allowed_sensitivity: readonly SensitivityLevel[];
  /**
   * When true, a `sensitive` item is allowed through if its themes
   * intersect `intent.session_mentioned_topics` (SSOT D.3.2). Weekly
   * summary ignores the override (hard block, SSOT E.6.3).
   */
  readonly respect_session_mention: boolean;
  /**
   * If true, items that lose a conflict resolution AND any mutual
   * unresolved contradictions are excluded (SSOT E.6.3 — Chat reply
   * row, E.6.4).
   */
  readonly exclude_contradictory: boolean;
}

const ALL_STATUSES_ACTIVE: readonly MemoryItemStatus[] = [
  "active",
  "re_check",
];

const ALL_SENSITIVITY_EXCEPT_AVOIDED: readonly SensitivityLevel[] = [
  "public",
  "personal",
  "sensitive",
];

/**
 * Canonical rule table. Every entry references the SSOT section(s)
 * that justify the specific constraints.
 */
export const SURFACE_RULES: Record<RetrievalSurface, SurfaceRules> = {
  smart_summary_post_checkin: {
    id: "smart_summary_post_checkin",
    budget: RETRIEVAL_BUDGET.smart_summary_post_checkin,
    // SSOT E.6.3 — "Raw low-confidence hypotheses (active_confidence
    // < 0.5)" are never included in Smart Summary.
    min_active_confidence: ACTIVE_CONFIDENCE_INSIGHT_MIN,
    allowed_statuses: ALL_STATUSES_ACTIVE,
    allowed_types: [],
    // SSOT E.6.3 "Never included: sensitive items"; SSOT D.3.2 allows
    // override when user mentioned topic this session.
    allowed_sensitivity: ["public", "personal"],
    respect_session_mention: true,
    exclude_contradictory: false,
  },
  chat_reply: {
    id: "chat_reply",
    budget: RETRIEVAL_BUDGET.chat_reply,
    min_active_confidence: ACTIVE_CONFIDENCE_RETRIEVAL_MIN,
    allowed_statuses: ALL_STATUSES_ACTIVE,
    allowed_types: [],
    allowed_sensitivity: ["public", "personal"],
    respect_session_mention: true,
    // SSOT E.6.3 — chat reply "Never: Contradictory items (unresolved
    // conflicts)".
    exclude_contradictory: true,
  },
  weekly_summary: {
    id: "weekly_summary",
    budget: RETRIEVAL_BUDGET.weekly_summary,
    min_active_confidence: ACTIVE_CONFIDENCE_RETRIEVAL_MIN,
    allowed_statuses: ["active"],
    allowed_types: [],
    // SSOT D.3.2: weekly summary never shows sensitive items.
    // E.6.3 allows user-consent override; consent mechanism is not in
    // P0 → hard block.
    allowed_sensitivity: ["public", "personal"],
    respect_session_mention: false,
    exclude_contradictory: true,
  },
  self_discovery_go_deeper: {
    id: "self_discovery_go_deeper",
    budget: RETRIEVAL_BUDGET.self_discovery_go_deeper,
    min_active_confidence: ACTIVE_CONFIDENCE_RETRIEVAL_MIN,
    allowed_statuses: ALL_STATUSES_ACTIVE,
    allowed_types: [],
    allowed_sensitivity: ["public", "personal"],
    respect_session_mention: true,
    exclude_contradictory: false,
  },
  plan_context: {
    id: "plan_context",
    budget: RETRIEVAL_BUDGET.plan_context,
    min_active_confidence: ACTIVE_CONFIDENCE_RETRIEVAL_MIN,
    allowed_statuses: ["active"],
    // SSOT E.6.3 — plan context Always: declared preferences +
    // what_tends_to_help; Never: chat-level hypotheses (noise).
    allowed_types: [
      "declared_preference",
      "declared_boundary",
      "immutable_fact",
      "confirmed_insight",
      "temporary_constraint",
    ],
    allowed_sensitivity: ["public", "personal"],
    respect_session_mention: false,
    exclude_contradictory: true,
  },
  memory_screen: {
    id: "memory_screen",
    budget: RETRIEVAL_BUDGET.memory_screen,
    // Memory screen shows everything not-decayed-to-zero; the
    // threshold still excludes items the user has hidden via low
    // active_confidence retention (SSOT D.4.3 last bullet).
    min_active_confidence: 0,
    // SSOT E.6.3 — memory screen Never: stale, hidden.
    allowed_statuses: ["active", "re_check"],
    allowed_types: [],
    // Memory screen is user-facing — they can see their own sensitive
    // items.
    allowed_sensitivity: ALL_SENSITIVITY_EXCEPT_AVOIDED,
    respect_session_mention: false,
    exclude_contradictory: false,
  },
};

export interface SessionMentionContext {
  session_mentioned_topics: readonly string[];
}

/**
 * Decide whether `item` passes the per-surface policy gate. Returns
 * `null` if the item passes, otherwise the reason for exclusion.
 *
 * NOTE: this function does NOT consider `active_confidence` — that is
 * applied by retrieve() after recomputing from `clock.now()` so the
 * cached column is never trusted (SSOT D.4.3).
 */
export function surfacePolicyReject(
  rules: SurfaceRules,
  item: MemoryItem,
  ctx: SessionMentionContext,
): SurfaceRejectReason | null {
  if (!rules.allowed_statuses.includes(item.status)) {
    return { kind: "status", reason: `status=${item.status} not allowed` };
  }
  if (
    rules.allowed_types.length > 0 &&
    !rules.allowed_types.includes(item.type)
  ) {
    return { kind: "type", reason: `type=${item.type} not in allowlist` };
  }
  if (!rules.allowed_sensitivity.includes(item.sensitivity_level)) {
    // Sensitivity override — SSOT D.3.2.
    if (
      item.sensitivity_level === "sensitive" &&
      rules.respect_session_mention &&
      hasSessionMentionOverlap(item, ctx)
    ) {
      return null;
    }
    return {
      kind: "sensitivity",
      reason: `sensitivity=${item.sensitivity_level} not allowed for ${rules.id}`,
    };
  }
  return null;
}

export interface SurfaceRejectReason {
  kind: "status" | "type" | "sensitivity";
  reason: string;
}

function hasSessionMentionOverlap(
  item: MemoryItem,
  ctx: SessionMentionContext,
): boolean {
  if (ctx.session_mentioned_topics.length === 0) return false;
  const mentioned = new Set(ctx.session_mentioned_topics);
  for (const t of item.theme_tags) if (mentioned.has(t)) return true;
  for (const f of item.related_focus_areas) if (mentioned.has(f)) return true;
  return false;
}
