/**
 * Memory correction — rollback of `Not quite` / `Not anymore` / `Hide`
 * within the 24-hour window. SSOT D.2.4.
 *
 * Workflow:
 *   1. UI picks the most recent revertible audit event on an item.
 *   2. `canRollback()` (pure, SSOT D.2.4) decides allowance + restore
 *      payload. This module then:
 *        a. rebuilds the item from its current state using the
 *           `previous_state` block of the audit event;
 *        b. writes a paired `correction` audit entry so the rollback
 *           itself is traceable (D.6);
 *        c. persists through `StorageAdapter.upsertMemoryItem`.
 *
 * Anything outside the 24h window is rejected. The UI should either
 * hide the control or show the copy from `RollbackVerdict.reason`.
 */

import type { StorageAdapter } from "../adapters/storage";
import type { TelemetryAdapter } from "../adapters/telemetry";
import { canRollback, type RollbackVerdict } from "../state/rollback";
import { freshnessScore } from "../state/decay";
import { computeActiveConfidence } from "../state/confidence";
import { newUuid } from "../async/id";
import type {
  ContextSurface,
  MemoryAuditEvent,
  MemoryItem,
  MemoryStateHistoryEntry,
} from "../types";

export interface RollbackParams {
  item: MemoryItem;
  audit: MemoryAuditEvent;
  now: Date;
  context_surface?: ContextSurface;
}

export interface RollbackResult {
  allowed: boolean;
  verdict: RollbackVerdict;
  item?: MemoryItem;
  audit?: MemoryAuditEvent;
}

export function computeRollback(params: RollbackParams): RollbackResult {
  const verdict = canRollback(params.audit, params.now);
  if (!verdict.allowed || !verdict.restore) {
    return { allowed: false, verdict };
  }

  const prevStatus = params.item.status;
  const restored: MemoryItem = {
    ...params.item,
    confidence: verdict.restore.confidence,
    status: verdict.restore.status,
    user_feedback_state:
      verdict.restore.user_feedback_state ?? params.item.user_feedback_state,
    visibility_scope:
      verdict.restore.visibility_scope ?? params.item.visibility_scope,
  };

  const fresh = freshnessScore(
    restored.type,
    new Date(restored.last_supported_at),
    params.now,
  );
  restored.freshness_score = fresh;
  restored.active_confidence = computeActiveConfidence(
    restored.confidence,
    fresh,
  );
  restored.last_confidence_computed_at = params.now.toISOString();
  restored.version = params.item.version + 1;
  restored.updated_at = params.now.toISOString();

  const history: MemoryStateHistoryEntry[] = [...params.item.state_history];
  if (prevStatus !== restored.status) {
    history.push({
      from_status: prevStatus,
      to_status: restored.status,
      trigger_event_id: params.audit.event_id,
      timestamp: params.now.toISOString(),
      auto_or_manual: "user",
    });
  }
  restored.state_history = history;

  const correctionAudit: MemoryAuditEvent = {
    event_id: newUuid(),
    memory_item_id: params.item.id,
    action: "correction",
    user_id: params.item.user_id,
    timestamp: params.now.toISOString(),
    previous_state: {
      confidence: params.item.confidence,
      status: params.item.status,
      user_feedback_state: params.item.user_feedback_state,
      visibility_scope: params.item.visibility_scope,
    },
    new_state: {
      confidence: restored.confidence,
      status: restored.status,
      user_feedback_state: restored.user_feedback_state,
      visibility_scope: restored.visibility_scope,
    },
    context_surface: params.context_surface ?? "memory_screen",
    source_event_id: params.audit.event_id,
  };

  return {
    allowed: true,
    verdict,
    item: restored,
    audit: correctionAudit,
  };
}

export interface PersistRollbackOptions {
  storage: StorageAdapter;
  telemetry?: TelemetryAdapter;
}

export async function persistRollback(
  opts: PersistRollbackOptions,
  params: RollbackParams,
): Promise<RollbackResult> {
  const result = computeRollback(params);
  if (!result.allowed || !result.item || !result.audit) return result;

  await opts.storage.upsertMemoryItem(result.item, result.audit);

  opts.telemetry?.capture("memory.rollback_applied", {
    user_id: params.item.user_id,
    memory_item_id: params.item.id,
    reverted_event_id: params.audit.event_id,
    reverted_action: params.audit.action,
    prev_status: params.item.status,
    next_status: result.item.status,
    window_hours: result.verdict.window_hours,
    timestamp: params.now.toISOString(),
  });

  return result;
}
