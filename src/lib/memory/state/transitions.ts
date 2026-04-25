/**
 * State machine transitions — SSOT D.2.2.
 *
 * All functions are pure: they read an item (or a bag of observations)
 * plus a window of signals and return an eligibility verdict with a
 * machine-readable reason. They do NOT mutate storage — EPIC 6
 * (`itemUpsert`) is the only module allowed to do that.
 *
 * Conventions:
 * - All timestamps are `Date`. "now" is always supplied by the caller
 *   (to keep everything deterministic for tests and adapter-injected).
 * - Windows are inclusive on the "now" side and measured in whole days
 *   via ms delta. Fractional days are preserved.
 * - Result shape is always `{ eligible: boolean; reason: string; meta? }`.
 *
 * SSOT guardrails explicitly enforced here:
 * - D.5.3: resonance signals (like/dislike/regenerate/echo_save) can
 *   NEVER upgrade `hypothesis` to `confirmed_insight`, regardless of
 *   volume.
 * - D.2.2 (stale revival): in P0/P0b, `stale → hypothesis` requires an
 *   explicit manual flag; it is never automatic.
 */

import { STATE_MACHINE } from "../constants";
import type {
  MemoryItem,
  MemoryItemType,
  SignalKind,
  UserFeedbackState,
} from "../types";
import { canSignalUpgradeToConfirmedInsight } from "./signalRegistry";
import type { SignalId } from "./signalRegistry";

/**
 * Generic evidence event used by transition evaluators. It is a narrow
 * projection over whatever the storage layer holds; transitions only
 * need enough to apply D.2.2 rules.
 */
export interface EvidenceEvent {
  event_id: string;
  signal_id: SignalId;
  signal_kind: SignalKind;
  /** Required — transitions are always windowed. */
  timestamp: Date;
  /**
   * Intended target of the signal. `memory_item_id` for per-item
   * explicit signals (Yes that fits / Not quite / ...); `theme_tag`
   * for aggregate pattern-detection.
   */
  memory_item_id?: string;
  theme_tag?: string;
}

export interface ObservationFact {
  id: string;
  theme_tag: string;
  /** Result of `computeSignalStrength` at the time the observation was recorded. */
  signal_strength: number;
  timestamp: Date;
}

export type TransitionName =
  | "observation_to_hypothesis"
  | "hypothesis_to_confirmed_insight"
  | "hypothesis_to_stale"
  | "confirmed_insight_to_re_check"
  | "re_check_to_confirmed_insight"
  | "re_check_to_stale"
  | "stale_to_hypothesis_revival";

export type TransitionVerdict<Meta = Record<string, unknown>> = {
  transition: TransitionName;
  eligible: boolean;
  reason: string;
  meta?: Meta;
};

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function inWindow(ts: Date, now: Date, windowDays: number): boolean {
  return ts.getTime() >= daysAgo(now, windowDays).getTime() &&
    ts.getTime() <= now.getTime();
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/* ------------------------------------------------------------------ */
/* observation → hypothesis (SSOT D.2.2)                              */
/* ------------------------------------------------------------------ */

export function evaluateObservationToHypothesis(
  observations: ObservationFact[],
  theme_tag: string,
  now: Date,
): TransitionVerdict<{
  matched: number;
  avg_signal_strength: number;
  window_days: number;
}> {
  const cfg = STATE_MACHINE.observation_to_hypothesis;
  const matched = observations.filter(
    (o) => o.theme_tag === theme_tag && inWindow(o.timestamp, now, cfg.window_days),
  );
  const avg = average(matched.map((o) => o.signal_strength));

  const eligible =
    matched.length >= cfg.min_consistent_observations &&
    avg >= cfg.min_avg_signal_strength;

  return {
    transition: "observation_to_hypothesis",
    eligible,
    reason: eligible
      ? `>=${cfg.min_consistent_observations} consistent observations in ${cfg.window_days}d with avg signal_strength ${avg.toFixed(2)} >= ${cfg.min_avg_signal_strength}`
      : matched.length < cfg.min_consistent_observations
        ? `only ${matched.length} consistent observations (need ${cfg.min_consistent_observations})`
        : `avg signal_strength ${avg.toFixed(2)} < ${cfg.min_avg_signal_strength}`,
    meta: {
      matched: matched.length,
      avg_signal_strength: avg,
      window_days: cfg.window_days,
    },
  };
}

/* ------------------------------------------------------------------ */
/* hypothesis → confirmed_insight (SSOT D.2.2, 2 paths)               */
/* ------------------------------------------------------------------ */

export function evaluateHypothesisToConfirmedInsight(
  item: MemoryItem,
  signals: EvidenceEvent[],
  now: Date,
): TransitionVerdict<{
  path: "A" | "B" | null;
  confirmations_in_30d: number;
  confirmations_in_21d: number;
  corroborations_in_21d: number;
  has_contradiction_in_window: boolean;
}> {
  if (item.type !== "hypothesis") {
    return {
      transition: "hypothesis_to_confirmed_insight",
      eligible: false,
      reason: `item type must be 'hypothesis' (got '${item.type}')`,
    };
  }

  const cfg = STATE_MACHINE.hypothesis_to_confirmed;

  // D.5.3 guardrail: only truth-upgrade signals count. Resonance
  // signals are filtered out before any counting happens, regardless
  // of volume.
  const relevant = signals.filter(
    (s) => s.memory_item_id === item.id,
  );
  const truthUpgrades = relevant.filter((s) =>
    canSignalUpgradeToConfirmedInsight(s.signal_id),
  );

  const in30d = truthUpgrades.filter((s) =>
    inWindow(s.timestamp, now, cfg.path_a.window_days),
  );
  const in21d = truthUpgrades.filter((s) =>
    inWindow(s.timestamp, now, cfg.path_b.window_days),
  );

  const corroborations21d = relevant.filter(
    (s) =>
      s.signal_kind === "corroboration" &&
      inWindow(s.timestamp, now, cfg.path_b.window_days),
  );

  // "No explicit contradiction signals in the same window."
  const contradictions30d = relevant.filter(
    (s) =>
      s.signal_kind === "contradiction" &&
      inWindow(s.timestamp, now, cfg.path_a.window_days),
  );
  const contradictions21d = relevant.filter(
    (s) =>
      s.signal_kind === "contradiction" &&
      inWindow(s.timestamp, now, cfg.path_b.window_days),
  );

  const pathAOk =
    in30d.length >= cfg.path_a.min_explicit_confirmations &&
    contradictions30d.length === 0;
  const pathBOk =
    in21d.length >= cfg.path_b.min_explicit_confirmations &&
    corroborations21d.length >= cfg.path_b.min_corroborating_signals &&
    contradictions21d.length === 0;

  const path: "A" | "B" | null = pathAOk ? "A" : pathBOk ? "B" : null;

  return {
    transition: "hypothesis_to_confirmed_insight",
    eligible: path !== null,
    reason:
      path === "A"
        ? `path A: ${in30d.length} explicit confirmations in ${cfg.path_a.window_days}d, no contradictions`
        : path === "B"
          ? `path B: ${in21d.length} confirmation(s) + ${corroborations21d.length} corroborations in ${cfg.path_b.window_days}d, no contradictions`
          : `confirmations in 30d: ${in30d.length}; in 21d: ${in21d.length} with ${corroborations21d.length} corroborations; contradictions present: ${contradictions30d.length > 0 || contradictions21d.length > 0}`,
    meta: {
      path,
      confirmations_in_30d: in30d.length,
      confirmations_in_21d: in21d.length,
      corroborations_in_21d: corroborations21d.length,
      has_contradiction_in_window:
        contradictions30d.length > 0 || contradictions21d.length > 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/* hypothesis → stale (SSOT D.2.2)                                    */
/* ------------------------------------------------------------------ */

export function evaluateHypothesisToStale(
  item: MemoryItem,
  signals: EvidenceEvent[],
  now: Date,
): TransitionVerdict<{
  days_since_last_supported: number;
  soft_reject_count: number;
  confidence: number;
  rule: "no_support" | "soft_reject" | "confidence_decay" | null;
}> {
  if (item.type !== "hypothesis") {
    return {
      transition: "hypothesis_to_stale",
      eligible: false,
      reason: `item type must be 'hypothesis' (got '${item.type}')`,
    };
  }

  const cfg = STATE_MACHINE.hypothesis_to_stale;

  const daysSince =
    (now.getTime() - new Date(item.last_supported_at).getTime()) /
    (24 * 60 * 60 * 1000);

  // soft-reject is the `not_quite` signal per D.5.1; count all-time
  // against this item.
  const softRejects = signals.filter(
    (s) => s.memory_item_id === item.id && s.signal_id === "not_quite",
  ).length;

  const noSupport = daysSince > cfg.no_support_days;
  const rejected = softRejects >= cfg.soft_reject_count;
  const confidenceTooLow = item.confidence < cfg.min_confidence;

  const rule: "no_support" | "soft_reject" | "confidence_decay" | null =
    noSupport ? "no_support" : rejected ? "soft_reject" : confidenceTooLow ? "confidence_decay" : null;

  return {
    transition: "hypothesis_to_stale",
    eligible: rule !== null,
    reason:
      rule === "no_support"
        ? `no supporting signal for ${daysSince.toFixed(1)}d (> ${cfg.no_support_days}d)`
        : rule === "soft_reject"
          ? `${softRejects} Not quite signal(s) (>= ${cfg.soft_reject_count})`
          : rule === "confidence_decay"
            ? `confidence ${item.confidence.toFixed(2)} < ${cfg.min_confidence}`
            : `no trigger matched`,
    meta: {
      days_since_last_supported: daysSince,
      soft_reject_count: softRejects,
      confidence: item.confidence,
      rule,
    },
  };
}

/* ------------------------------------------------------------------ */
/* confirmed_insight → re_check (SSOT D.2.2)                          */
/* ------------------------------------------------------------------ */

export function evaluateConfirmedInsightToReCheck(
  item: MemoryItem,
  signals: EvidenceEvent[],
  now: Date,
  options: {
    recalibration_shows_contradiction?: boolean;
  } = {},
): TransitionVerdict<{
  has_not_quite: boolean;
  contradicting_behavior_signals_in_14d: number;
  recalibration_flag: boolean;
  rule:
    | "not_quite"
    | "behavioral_contradiction"
    | "post_pause_recalibration"
    | null;
}> {
  if (item.type !== "confirmed_insight") {
    return {
      transition: "confirmed_insight_to_re_check",
      eligible: false,
      reason: `item type must be 'confirmed_insight' (got '${item.type}')`,
    };
  }

  const cfg = STATE_MACHINE.confirmed_to_re_check;

  const relevant = signals.filter((s) => s.memory_item_id === item.id);

  const hasNotQuite = relevant.some((s) => s.signal_id === "not_quite");

  const contradicting = relevant.filter(
    (s) =>
      s.signal_kind === "contradiction" &&
      s.signal_id !== "not_quite" && // not_quite handled separately
      inWindow(s.timestamp, now, cfg.contradicting_window_days),
  ).length;

  const recalibration = Boolean(options.recalibration_shows_contradiction);

  const rule:
    | "not_quite"
    | "behavioral_contradiction"
    | "post_pause_recalibration"
    | null = hasNotQuite
    ? "not_quite"
    : contradicting >= cfg.contradicting_signals_count
      ? "behavioral_contradiction"
      : recalibration
        ? "post_pause_recalibration"
        : null;

  return {
    transition: "confirmed_insight_to_re_check",
    eligible: rule !== null,
    reason:
      rule === "not_quite"
        ? `user marked Not quite on insight`
        : rule === "behavioral_contradiction"
          ? `${contradicting} contradicting behavior signals in ${cfg.contradicting_window_days}d`
          : rule === "post_pause_recalibration"
            ? `post-pause re-calibration shows sustained contradiction`
            : `no trigger matched`,
    meta: {
      has_not_quite: hasNotQuite,
      contradicting_behavior_signals_in_14d: contradicting,
      recalibration_flag: recalibration,
      rule,
    },
  };
}

/* ------------------------------------------------------------------ */
/* re_check → confirmed_insight (restoration, SSOT D.2.2)             */
/* ------------------------------------------------------------------ */

export function evaluateReCheckToConfirmedInsight(
  item: MemoryItem,
  signals: EvidenceEvent[],
  now: Date,
): TransitionVerdict<{ confirmations_in_14d: number }> {
  if (item.type !== "confirmed_insight" || item.status !== "re_check") {
    return {
      transition: "re_check_to_confirmed_insight",
      eligible: false,
      reason: `item must be confirmed_insight in re_check (got type='${item.type}', status='${item.status}')`,
    };
  }

  const cfg = STATE_MACHINE.re_check_to_confirmed;
  const confirmations = signals.filter(
    (s) =>
      s.memory_item_id === item.id &&
      canSignalUpgradeToConfirmedInsight(s.signal_id) &&
      inWindow(s.timestamp, now, cfg.window_days),
  ).length;

  const eligible = confirmations >= cfg.min_confirmations;

  return {
    transition: "re_check_to_confirmed_insight",
    eligible,
    reason: eligible
      ? `${confirmations} confirmations in ${cfg.window_days}d (>= ${cfg.min_confirmations})`
      : `${confirmations} confirmations in ${cfg.window_days}d (need ${cfg.min_confirmations})`,
    meta: { confirmations_in_14d: confirmations },
  };
}

/* ------------------------------------------------------------------ */
/* re_check → stale (SSOT D.2.2)                                      */
/* ------------------------------------------------------------------ */

export function evaluateReCheckToStale(
  item: MemoryItem,
  signals: EvidenceEvent[],
  now: Date,
): TransitionVerdict<{
  days_in_re_check: number;
  not_anymore: boolean;
  rule: "not_anymore" | "no_resolution" | null;
}> {
  if (item.status !== "re_check") {
    return {
      transition: "re_check_to_stale",
      eligible: false,
      reason: `item must be in re_check (got '${item.status}')`,
    };
  }

  const cfg = STATE_MACHINE.re_check_to_stale;

  const notAnymore = signals.some(
    (s) => s.memory_item_id === item.id && s.signal_id === "not_anymore",
  );

  // Derive time since item entered re_check from state_history; fallback
  // to updated_at if no history entry (should never happen in practice).
  const entered = findLastTransitionTo(item, "re_check");
  const reference = entered ?? new Date(item.updated_at);
  const daysInReCheck =
    (now.getTime() - reference.getTime()) / (24 * 60 * 60 * 1000);

  const rule: "not_anymore" | "no_resolution" | null = notAnymore
    ? "not_anymore"
    : daysInReCheck >= cfg.no_resolution_days
      ? "no_resolution"
      : null;

  return {
    transition: "re_check_to_stale",
    eligible: rule !== null,
    reason:
      rule === "not_anymore"
        ? `user marked Not anymore`
        : rule === "no_resolution"
          ? `${daysInReCheck.toFixed(1)}d in re_check without resolution (>= ${cfg.no_resolution_days}d)`
          : `${daysInReCheck.toFixed(1)}d in re_check, no trigger`,
    meta: {
      days_in_re_check: daysInReCheck,
      not_anymore: notAnymore,
      rule,
    },
  };
}

function findLastTransitionTo(
  item: MemoryItem,
  status: MemoryItem["status"],
): Date | null {
  for (let i = item.state_history.length - 1; i >= 0; i -= 1) {
    const entry = item.state_history[i];
    if (entry.to_status === status) return new Date(entry.timestamp);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* stale → hypothesis revival (SSOT D.2.2)                            */
/* ------------------------------------------------------------------ */

export function evaluateStaleToHypothesisRevival(
  item: MemoryItem,
  newObservationsAfterStale: ObservationFact[],
  options: {
    /** P0/P0b: manual flag MUST be explicitly set; automatic is P1 only. */
    manual_revival_flag: boolean;
  },
): TransitionVerdict<{
  new_consistent_observations: number;
  automatic_allowed: boolean;
  manual_flag: boolean;
}> {
  if (item.status !== "stale") {
    return {
      transition: "stale_to_hypothesis_revival",
      eligible: false,
      reason: `item must be in stale (got '${item.status}')`,
    };
  }

  const cfg = STATE_MACHINE.stale_revival;
  const count = newObservationsAfterStale.length;
  const thresholdMet = count >= cfg.min_new_consistent_observations;

  // D.2.2: "Не автоматично: потребує додаткового flag revival_candidate
  // для manual review у P0/P0b фазі". `automatic: false` is encoded in
  // STATE_MACHINE.stale_revival.
  const eligible = thresholdMet && options.manual_revival_flag;

  return {
    transition: "stale_to_hypothesis_revival",
    eligible,
    reason: !thresholdMet
      ? `${count} new observations (need ${cfg.min_new_consistent_observations})`
      : !options.manual_revival_flag
        ? `threshold met (${count}) but manual revival flag is required in P0/P0b`
        : `revival candidate: ${count} new observations and manual flag set`,
    meta: {
      new_consistent_observations: count,
      automatic_allowed: cfg.automatic,
      manual_flag: options.manual_revival_flag,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Convenience: evaluate all outgoing transitions for an item         */
/* ------------------------------------------------------------------ */

export interface TransitionEvaluationContext {
  signals: EvidenceEvent[];
  now: Date;
  recalibration_shows_contradiction?: boolean;
  manual_revival_flag?: boolean;
  /** Observations tied to this item's theme (for revival). */
  observations_for_revival?: ObservationFact[];
}

export function evaluateTransitionsForItem(
  item: MemoryItem,
  ctx: TransitionEvaluationContext,
): TransitionVerdict[] {
  const verdicts: TransitionVerdict[] = [];

  if (item.type === "hypothesis" && item.status === "active") {
    verdicts.push(
      evaluateHypothesisToConfirmedInsight(item, ctx.signals, ctx.now),
    );
    verdicts.push(evaluateHypothesisToStale(item, ctx.signals, ctx.now));
  }

  if (item.type === "confirmed_insight" && item.status === "active") {
    verdicts.push(
      evaluateConfirmedInsightToReCheck(item, ctx.signals, ctx.now, {
        recalibration_shows_contradiction:
          ctx.recalibration_shows_contradiction,
      }),
    );
  }

  if (item.type === "confirmed_insight" && item.status === "re_check") {
    verdicts.push(
      evaluateReCheckToConfirmedInsight(item, ctx.signals, ctx.now),
    );
    verdicts.push(evaluateReCheckToStale(item, ctx.signals, ctx.now));
  }

  if (item.status === "stale" && (ctx.observations_for_revival?.length ?? 0) > 0) {
    verdicts.push(
      evaluateStaleToHypothesisRevival(
        item,
        ctx.observations_for_revival ?? [],
        { manual_revival_flag: Boolean(ctx.manual_revival_flag) },
      ),
    );
  }

  return verdicts;
}

/**
 * Guardrail predicate — matches the DoD test "like × 100 → never
 * confirmed_insight". Returns the count of signals that would actually
 * count toward truth-upgrade (filtering out resonance-only signals).
 */
export function countTruthUpgradeSignals(
  signals: EvidenceEvent[],
  memory_item_id: string,
): number {
  return signals.filter(
    (s) =>
      s.memory_item_id === memory_item_id &&
      canSignalUpgradeToConfirmedInsight(s.signal_id),
  ).length;
}

export type { MemoryItemType, UserFeedbackState };
