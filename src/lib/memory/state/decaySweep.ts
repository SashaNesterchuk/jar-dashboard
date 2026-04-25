/**
 * Decay sweep — SSOT D.4.4 + D.2.2.
 *
 * Pure iteration over a user's memory items that:
 *   1. Recomputes `freshness_score`, `active_confidence`, and
 *      `last_confidence_computed_at` against `now` (SSOT D.4.3).
 *   2. Detects state transitions driven by decay alone:
 *        - `hypothesis → stale` when `confidence < 0.25` OR
 *          `no_support_days >= 30` (SSOT D.2.2 / constants.STATE_MACHINE).
 *   3. Emits a paired `MemoryAuditEvent` (action `correction`) for every
 *      item that actually changed so callers can persist both in a
 *      single `StorageAdapter.upsertMemoryItem` call (SSOT D.6).
 *
 * The sweep is idempotent: running it twice in a row is a no-op when
 * nothing else has changed between runs. Callers must supply `now`
 * through the `ClockAdapter`.
 */

import { STATE_MACHINE } from "../constants";
import { newUuid } from "../async/id";
import { recomputeActiveConfidence } from "../retrieval/relevance";
import { daysBetween, freshnessScore } from "./decay";
import type {
  MemoryAuditEvent,
  MemoryItem,
  MemoryItemStatus,
} from "../types";

export interface SweepDecayResult {
  items: MemoryItem[];
  audits: MemoryAuditEvent[];
  /** Items whose status flipped (e.g. hypothesis → stale). */
  transitions: Array<{
    item_id: string;
    from_status: MemoryItemStatus;
    to_status: MemoryItemStatus;
    reason: string;
  }>;
}

export function sweepDecay(
  input: { items: readonly MemoryItem[]; now: Date },
): SweepDecayResult {
  const items: MemoryItem[] = [];
  const audits: MemoryAuditEvent[] = [];
  const transitions: SweepDecayResult["transitions"] = [];

  for (const raw of input.items) {
    const fresh = freshnessScore(
      raw.type,
      new Date(raw.last_supported_at),
      input.now,
    );
    const active = recomputeActiveConfidence(raw, input.now);

    const { nextStatus, reason } = resolveDecayTransition(raw, input.now);

    // If nothing changed beyond the cached freshness, skip work to keep
    // the sweep idempotent and cheap.
    const cacheChanged =
      raw.freshness_score !== fresh || raw.active_confidence !== active;
    if (!cacheChanged && nextStatus === raw.status) continue;

    const updated: MemoryItem = {
      ...raw,
      freshness_score: fresh,
      active_confidence: active,
      last_confidence_computed_at: input.now.toISOString(),
      status: nextStatus,
      state_history:
        nextStatus === raw.status
          ? raw.state_history
          : [
              ...raw.state_history,
              {
                from_status: raw.status,
                to_status: nextStatus,
                trigger_event_id: `decay_sweep:${input.now.toISOString()}`,
                timestamp: input.now.toISOString(),
                auto_or_manual: "auto",
              },
            ],
      updated_at: input.now.toISOString(),
    };

    items.push(updated);
    audits.push(buildAudit(raw, updated, input.now));

    if (nextStatus !== raw.status) {
      transitions.push({
        item_id: raw.id,
        from_status: raw.status,
        to_status: nextStatus,
        reason,
      });
    }
  }

  return { items, audits, transitions };
}

/* ---------------------------------------------------------------- helpers */

function resolveDecayTransition(
  item: MemoryItem,
  now: Date,
): { nextStatus: MemoryItemStatus; reason: string } {
  if (item.status !== "active") {
    return { nextStatus: item.status, reason: "non-active status unchanged" };
  }

  if (item.type === "hypothesis") {
    const daysSinceSupport = daysBetween(
      new Date(item.last_supported_at),
      now,
    );
    if (item.confidence < STATE_MACHINE.hypothesis_to_stale.min_confidence) {
      return {
        nextStatus: "stale",
        reason: `confidence ${item.confidence.toFixed(
          3,
        )} below threshold ${STATE_MACHINE.hypothesis_to_stale.min_confidence}`,
      };
    }
    if (daysSinceSupport >= STATE_MACHINE.hypothesis_to_stale.no_support_days) {
      return {
        nextStatus: "stale",
        reason: `no supporting signal for ${daysSinceSupport.toFixed(
          1,
        )} days (≥ ${STATE_MACHINE.hypothesis_to_stale.no_support_days})`,
      };
    }
  }

  return { nextStatus: item.status, reason: "no transition" };
}

function buildAudit(
  before: MemoryItem,
  after: MemoryItem,
  now: Date,
): MemoryAuditEvent {
  return {
    event_id: newUuid(),
    memory_item_id: before.id,
    action: "correction",
    user_id: before.user_id,
    timestamp: now.toISOString(),
    previous_state: {
      confidence: before.confidence,
      status: before.status,
      user_feedback_state: before.user_feedback_state,
      visibility_scope: before.visibility_scope,
    },
    new_state: {
      confidence: after.confidence,
      status: after.status,
      user_feedback_state: after.user_feedback_state,
      visibility_scope: after.visibility_scope,
    },
    context_surface: "memory_screen",
    source_event_id: null,
  };
}
