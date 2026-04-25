/**
 * `itemUpsert` — applies a signal to a `MemoryItem` and produces a
 * paired audit record, per SSOT D.2.1 (allowed transitions), D.5.1
 * (signal registry deltas), D.5.3 (resonance never alters truth), and
 * D.6 (every state change is paired with an audit event).
 *
 * This module is the SINGLE point of mutation for memory items: state
 * machine evaluators (`state/transitions.ts`) decide eligibility; the
 * actual `confidence` / `status` / `visibility_scope` / sources update
 * happens here. Persistence stays in the StorageAdapter.
 *
 * Pure computation: `applySignalToItem` returns a new item + audit
 * without touching storage. `persistSignalToItem` wraps it in a single
 * atomic `StorageAdapter.upsertMemoryItem` call (contract in
 * `adapters/storage.ts`).
 */

import type { StorageAdapter } from "../adapters/storage";
import {
  canSignalUpgradeToConfirmedInsight,
  getSignal,
  type SignalId,
} from "../state/signalRegistry";
import {
  evaluateHypothesisToConfirmedInsight,
  evaluateHypothesisToStale,
  evaluateReCheckToConfirmedInsight,
  evaluateReCheckToStale,
  type EvidenceEvent,
  type TransitionName,
} from "../state/transitions";
import { freshnessScore } from "../state/decay";
import { computeActiveConfidence } from "../state/confidence";
import type {
  ContextSurface,
  MemoryAuditAction,
  MemoryAuditEvent,
  MemoryItem,
  MemoryItemSource,
  MemoryItemStatus,
  MemoryStateHistoryEntry,
  SignalKind,
  SourceType,
  UserFeedbackState,
  VisibilityScope,
} from "../types";
import { newUuid } from "./id";

export interface ApplySignalParams {
  item: MemoryItem;
  signal_id: SignalId;
  /** ISO timestamp of the signal, used both on source and audit. */
  now: Date;
  /** Originating event id — persisted on `sources[]` and `audit.source_event_id`. */
  source_event_id: string;
  /** Source type recorded on the item's `sources[]` entry. */
  source_type: SourceType;
  /** Optional session the signal originated from. */
  session_id?: string | null;
  /** Surface where the action happened (memory_screen, reflection, ...). */
  context_surface: ContextSurface;
  /**
   * Prior signals for this item. If omitted, the evaluator reconstructs
   * them from `item.sources`. Supplying an explicit list lets callers
   * fold in signals not yet captured as sources (e.g. in-flight batch
   * of feedback events).
   */
  prior_signals?: readonly EvidenceEvent[];
}

export interface ApplySignalResult {
  item: MemoryItem;
  audit: MemoryAuditEvent;
  transition: TransitionName | null;
  /** Net delta applied to `confidence` by this signal. */
  applied_delta: number;
}

/**
 * Apply a single signal to a `MemoryItem`. Pure.
 *
 * SSOT D.5.3 guardrail: resonance signals (`like`, `dislike`,
 * `regenerate`, `echo_save`) never change `confidence`, `status` or
 * `user_feedback_state` — only `sources[]` grows.
 */
export function applySignalToItem(
  params: ApplySignalParams,
): ApplySignalResult {
  const def = getSignal(params.signal_id);
  const signalKind: SignalKind = def.signal_kind ?? "resonance";

  const previous = {
    confidence: params.item.confidence,
    status: params.item.status,
    user_feedback_state: params.item.user_feedback_state,
    visibility_scope: params.item.visibility_scope,
  };

  let newConfidence = params.item.confidence;
  let newStatus: MemoryItemStatus = params.item.status;
  let newFeedback: UserFeedbackState = params.item.user_feedback_state;
  let newVisibility: VisibilityScope = params.item.visibility_scope;

  // ── 1. Apply signal-level deltas (SSOT D.5.1) ─────────────────────
  let appliedDelta = 0;
  if (signalKind !== "resonance") {
    const deltas = [
      def.delta,
      def.evidence_delta,
      def.corroboration_delta,
      def.contradiction_delta,
      def.truth_delta,
    ].filter((v): v is number => typeof v === "number");
    for (const d of deltas) appliedDelta += d;

    newConfidence = clamp01(newConfidence + appliedDelta);
  }

  // ── 2. Apply feedback-state mapping (SSOT C.3.4 / D.5.1) ──────────
  const feedbackByAction: Partial<Record<SignalId, UserFeedbackState>> = {
    yes_that_fits: "confirmed_by_user",
    not_quite: "rejected_by_user",
    not_anymore: "marked_stale_by_user",
  };
  const mappedFeedback = feedbackByAction[params.signal_id];
  if (mappedFeedback) newFeedback = mappedFeedback;

  // ── 3. Apply status transitions from the registry (SSOT D.2.1) ───
  if (def.transition === "status->re_check") {
    newStatus = "re_check";
  } else if (def.transition === "status->stale") {
    newStatus = "stale";
  }

  // ── 4. Visibility-only effect (`hide`) — SSOT C.3.4 row 4 ────────
  if (def.effect === "visibility_only" && params.signal_id === "hide") {
    newVisibility = "hidden";
  }

  // ── 5. Append to sources[] ───────────────────────────────────────
  const newSource: MemoryItemSource = {
    source_type: params.source_type,
    source_event_id: params.source_event_id,
    session_id: params.session_id ?? null,
    timestamp: params.now.toISOString(),
    weight: Math.abs(appliedDelta) || 0.05,
    signal_kind: signalKind,
  };
  const newSources: MemoryItemSource[] = [...params.item.sources, newSource];
  const newSourceEventIds = params.item.source_event_ids.includes(
    params.source_event_id,
  )
    ? params.item.source_event_ids
    : [...params.item.source_event_ids, params.source_event_id];

  // ── 6. Evaluate state-machine upgrade transitions that depend on
  //     accumulated signals (SSOT D.2.2). Registry-level transitions
  //     (not_quite / not_anymore) are already applied above. This pass
  //     handles hypothesis→confirmed_insight and re_check→*.
  const priorSignals = params.prior_signals
    ? [...params.prior_signals]
    : sourcesToSignals(params.item);
  const allSignals: EvidenceEvent[] = [
    ...priorSignals,
    {
      event_id: params.source_event_id,
      signal_id: params.signal_id,
      signal_kind: signalKind,
      timestamp: params.now,
      memory_item_id: params.item.id,
    },
  ];

  let transitionTriggered: TransitionName | null = null;
  const interim: MemoryItem = {
    ...params.item,
    confidence: newConfidence,
    status: newStatus,
    user_feedback_state: newFeedback,
    visibility_scope: newVisibility,
    sources: newSources,
  };

  // Hypothesis → confirmed_insight when the signal is a truth
  // confirmation and both paths in D.2.2 allow it.
  if (
    interim.type === "hypothesis" &&
    interim.status === "active" &&
    canSignalUpgradeToConfirmedInsight(params.signal_id)
  ) {
    const verdict = evaluateHypothesisToConfirmedInsight(
      interim,
      allSignals,
      params.now,
    );
    if (verdict.eligible) {
      interim.type = "confirmed_insight";
      transitionTriggered = "hypothesis_to_confirmed_insight";
    }
  }

  // Re_check → confirmed_insight restoration: 2 explicit confirmations
  // inside 14 days (SSOT D.2.2).
  if (
    interim.type === "confirmed_insight" &&
    interim.status === "re_check" &&
    canSignalUpgradeToConfirmedInsight(params.signal_id)
  ) {
    const verdict = evaluateReCheckToConfirmedInsight(
      interim,
      allSignals,
      params.now,
    );
    if (verdict.eligible) {
      interim.status = "active";
      transitionTriggered = "re_check_to_confirmed_insight";
    }
  }

  // Hypothesis → stale triggered by accumulated contradictions.
  if (
    interim.type === "hypothesis" &&
    interim.status === "active" &&
    signalKind === "contradiction"
  ) {
    const verdict = evaluateHypothesisToStale(interim, allSignals, params.now);
    if (verdict.eligible) {
      interim.status = "stale";
      transitionTriggered = "hypothesis_to_stale";
    }
  }

  // Re_check → stale when the user explicitly says "Not anymore".
  if (
    interim.status === "re_check" &&
    params.signal_id === "not_anymore"
  ) {
    const verdict = evaluateReCheckToStale(interim, allSignals, params.now);
    if (verdict.eligible) {
      interim.status = "stale";
      transitionTriggered = "re_check_to_stale";
    }
  }

  // ── 7. Rebuild derived timestamps / freshness ─────────────────────
  const isSupportive =
    signalKind === "truth_confirmation" ||
    signalKind === "corroboration" ||
    signalKind === "declaration";
  const lastSupportedAt = isSupportive
    ? params.now.toISOString()
    : params.item.last_supported_at;

  const fresh = freshnessScore(
    interim.type,
    new Date(lastSupportedAt),
    params.now,
  );
  const activeConfidence = computeActiveConfidence(interim.confidence, fresh);

  // ── 8. State history on status change ─────────────────────────────
  const history: MemoryStateHistoryEntry[] = [...params.item.state_history];
  if (interim.status !== params.item.status) {
    history.push({
      from_status: params.item.status,
      to_status: interim.status,
      trigger_event_id: params.source_event_id,
      timestamp: params.now.toISOString(),
      auto_or_manual:
        params.source_type === "memory_screen" ? "user" : "auto",
    });
  }

  const updatedItem: MemoryItem = {
    ...interim,
    sources: newSources,
    source_event_ids: newSourceEventIds,
    freshness_score: fresh,
    active_confidence: activeConfidence,
    last_confidence_computed_at: params.now.toISOString(),
    last_supported_at: lastSupportedAt,
    state_history: history,
    version: params.item.version + 1,
    updated_at: params.now.toISOString(),
  };

  // ── 9. Build the paired audit record (SSOT D.6) ───────────────────
  const audit: MemoryAuditEvent = {
    event_id: newUuid(),
    memory_item_id: params.item.id,
    action: signalToAuditAction(params.signal_id),
    user_id: params.item.user_id,
    timestamp: params.now.toISOString(),
    previous_state: {
      confidence: previous.confidence,
      status: previous.status,
      user_feedback_state: previous.user_feedback_state,
      visibility_scope: previous.visibility_scope,
    },
    new_state: {
      confidence: updatedItem.confidence,
      status: updatedItem.status,
      user_feedback_state: updatedItem.user_feedback_state,
      visibility_scope: updatedItem.visibility_scope,
    },
    context_surface: params.context_surface,
    source_event_id: params.source_event_id,
  };

  return {
    item: updatedItem,
    audit,
    transition: transitionTriggered,
    applied_delta: appliedDelta,
  };
}

/**
 * Convenience: run `applySignalToItem` and persist the result through
 * the StorageAdapter. The adapter contract guarantees the item + audit
 * are written atomically (SSOT D.6).
 */
export async function persistSignalToItem(
  storage: StorageAdapter,
  params: ApplySignalParams,
): Promise<ApplySignalResult> {
  const result = applySignalToItem(params);
  await storage.upsertMemoryItem(result.item, result.audit);
  return result;
}

/* --------------------------------------------------------------- helpers */

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function sourcesToSignals(item: MemoryItem): EvidenceEvent[] {
  return item.sources.map((s): EvidenceEvent => ({
    event_id: s.source_event_id,
    signal_id: sourceToSignalId(s) ?? "check_in_text",
    signal_kind: s.signal_kind,
    timestamp: new Date(s.timestamp),
    memory_item_id: item.id,
  }));
}

/**
 * Best-effort reverse lookup: we only store `source_type` + `signal_kind`
 * on `MemoryItemSource`, not the signal_id that produced the source.
 * For transition evaluation we fall back to the closest signal_id that
 * matches the signal_kind. Callers that need precise replay should
 * pass `prior_signals` explicitly.
 */
function sourceToSignalId(s: MemoryItemSource): SignalId | null {
  if (s.signal_kind === "truth_confirmation") return "yes_that_fits";
  if (s.signal_kind === "contradiction") {
    // `not_quite` is the most common contradiction; callers needing to
    // disambiguate `not_anymore` vs `practice_worse` must supply
    // `prior_signals`.
    return "not_quite";
  }
  if (s.signal_kind === "declaration") {
    return s.source_type === "onboarding"
      ? "onboarding_direct_answer"
      : "check_in_text";
  }
  if (s.signal_kind === "corroboration") {
    if (s.source_type === "reflection") return "reflection_text";
    if (s.source_type === "journal") return "journal_entry";
    if (s.source_type === "practice_feedback") return "practice_better";
    return "check_in_text";
  }
  if (s.signal_kind === "resonance") {
    if (s.source_type === "echo_save") return "echo_save";
    return "like";
  }
  return null;
}

function signalToAuditAction(signal_id: SignalId): MemoryAuditAction {
  switch (signal_id) {
    case "yes_that_fits":
      return "confirm";
    case "not_quite":
      return "soft_reject";
    case "not_anymore":
      return "mark_stale";
    case "hide":
      return "hide";
    default:
      // Non-feedback signals are also audited (D.6 paired audit) —
      // closest canonical action is `correction`.
      return "correction";
  }
}
