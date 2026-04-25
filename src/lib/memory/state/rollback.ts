/**
 * Rollback policy — SSOT D.2.4.
 *
 * Within 24h after an erroneous `Not anymore` / `Not quite`, the user
 * can revert the action in the memory screen. After 24h, the item
 * stays in `stale` / `re_check` and recovery must go through a fresh
 * explicit confirmation or new corroborating signals.
 *
 * This module is pure: given an audit event and a current time, it
 * reports whether a rollback is allowed and produces the state to
 * restore. Actual persistence is EPIC 6's job.
 */

import { ROLLBACK_WINDOW_HOURS } from "../constants";
import type { MemoryAuditEvent, MemoryItem, MemoryItemStatus } from "../types";

const REVERTIBLE_ACTIONS: ReadonlySet<MemoryAuditEvent["action"]> = new Set([
  "soft_reject",
  "mark_stale",
  "hide",
]);

export function isWithinRollbackWindow(
  audit: MemoryAuditEvent,
  now: Date,
): boolean {
  const deltaMs = now.getTime() - new Date(audit.timestamp).getTime();
  const maxMs = ROLLBACK_WINDOW_HOURS * 60 * 60 * 1000;
  return deltaMs >= 0 && deltaMs <= maxMs;
}

export interface RollbackVerdict {
  allowed: boolean;
  reason: string;
  /** State to restore on the memory item. */
  restore?: {
    confidence: number;
    status: MemoryItemStatus;
    user_feedback_state?: MemoryItem["user_feedback_state"];
    visibility_scope?: MemoryItem["visibility_scope"];
  };
  window_hours: number;
}

export function canRollback(
  audit: MemoryAuditEvent,
  now: Date,
): RollbackVerdict {
  const baseline = { window_hours: ROLLBACK_WINDOW_HOURS };

  if (!REVERTIBLE_ACTIONS.has(audit.action)) {
    return {
      ...baseline,
      allowed: false,
      reason: `action '${audit.action}' is not revertible (D.2.4 covers Not quite / Not anymore / Hide)`,
    };
  }

  if (!isWithinRollbackWindow(audit, now)) {
    return {
      ...baseline,
      allowed: false,
      reason: `outside ${ROLLBACK_WINDOW_HOURS}h window (D.2.4): recovery requires fresh explicit confirmation or new corroborating signals`,
    };
  }

  return {
    ...baseline,
    allowed: true,
    reason: `within ${ROLLBACK_WINDOW_HOURS}h — restoring previous state`,
    restore: {
      confidence: audit.previous_state.confidence,
      status: audit.previous_state.status,
      user_feedback_state: audit.previous_state.user_feedback_state,
      visibility_scope: audit.previous_state.visibility_scope,
    },
  };
}
