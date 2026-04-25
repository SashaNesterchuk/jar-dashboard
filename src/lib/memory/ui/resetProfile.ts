/**
 * Reset profile helpers — SSOT C.3.2 block 4.
 *
 * Two destructive controls surfaced on the Memory screen:
 *
 *   1. `Reset profile interpretation`
 *      Clears the derived memory interpretation while preserving the
 *      raw user-declared data. In practice: mark every
 *      `observation | hypothesis | confirmed_insight` as
 *      `removed_by_user` and keep `immutable_fact`,
 *      `declared_preference`, `declared_boundary`,
 *      `temporary_constraint` intact.
 *
 *   2. `Reset my profile`
 *      Full wipe — every memory item becomes `removed_by_user`, the
 *      derived stable profile is cleared. The caller redirects back to
 *      onboarding per SSOT F.5.3.
 *
 * This module is PURE: it returns the new `MemoryItem` rows + paired
 * audits. Persistence is the caller's job (atomic per-item via
 * `StorageAdapter.upsertMemoryItem`; profile wipe via
 * `upsertStableProfile` with a blank shape).
 */

import { newUuid } from "../async/id";
import type {
  MemoryAuditEvent,
  MemoryItem,
  MemoryItemType,
  StableProfile,
} from "../types";

export type ResetMode = "interpretation" | "full";

export interface ResetProfileResult {
  items: MemoryItem[];
  audits: MemoryAuditEvent[];
}

const INTERPRETATION_TYPES: ReadonlySet<MemoryItemType> = new Set([
  "observation",
  "hypothesis",
  "confirmed_insight",
]);

export function prepareReset(
  items: readonly MemoryItem[],
  mode: ResetMode,
  now: Date,
): ResetProfileResult {
  const nextItems: MemoryItem[] = [];
  const audits: MemoryAuditEvent[] = [];

  for (const item of items) {
    if (item.status === "removed_by_user") continue;
    if (mode === "interpretation" && !INTERPRETATION_TYPES.has(item.type)) {
      continue;
    }

    const updated: MemoryItem = {
      ...item,
      status: "removed_by_user",
      visibility_scope: "hidden",
      updated_at: now.toISOString(),
      state_history: [
        ...item.state_history,
        {
          from_status: item.status,
          to_status: "removed_by_user",
          trigger_event_id: `reset:${mode}:${now.toISOString()}`,
          timestamp: now.toISOString(),
          auto_or_manual: "user",
        },
      ],
    };
    nextItems.push(updated);
    audits.push({
      event_id: newUuid(),
      memory_item_id: item.id,
      action: "correction",
      user_id: item.user_id,
      timestamp: now.toISOString(),
      previous_state: {
        confidence: item.confidence,
        status: item.status,
        user_feedback_state: item.user_feedback_state,
        visibility_scope: item.visibility_scope,
      },
      new_state: {
        confidence: item.confidence,
        status: "removed_by_user",
        user_feedback_state: item.user_feedback_state,
        visibility_scope: "hidden",
      },
      context_surface: "memory_screen",
      source_event_id: null,
    });
  }

  return { items: nextItems, audits };
}

/**
 * Blank stable profile for `Reset my profile`. Preserves `user_id` and
 * `sign_up_date` so activity metrics don't reset to day-0; all
 * interpretation fields are cleared (SSOT D.8 + C.3.2).
 */
export function blankStableProfile(params: {
  userId: string;
  existing: StableProfile | null;
  now: Date;
}): StableProfile {
  return {
    user_id: params.userId,
    basics: {
      name: null,
      locale: params.existing?.basics.locale ?? null,
      sign_up_date:
        params.existing?.basics.sign_up_date ?? params.now.toISOString(),
    },
    declared: {
      primary_motivation: [],
      top_value: null,
      focus_areas: [],
      support_style: null,
      realistic_action_modes: [],
      daily_time_budget: null,
      support_timing_preference: null,
    },
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
    last_refreshed_at: params.now.toISOString(),
    activity_snapshot: params.existing?.activity_snapshot ?? {
      total_sessions: 0,
      days_active_in_last_14: 0,
      text_sessions_ratio: 0,
      streak_status: "none",
    },
  };
}
