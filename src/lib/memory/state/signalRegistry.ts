/**
 * Canonical signal registry — SSOT D.5.1.
 *
 * This is the SINGLE source of truth for weights / deltas / semantic
 * meaning of evidence sources. No other module is allowed to inline
 * these numbers; they must import from here.
 *
 * Weak-signal guardrails from SSOT D.5.4 are encoded as helper
 * functions below.
 */

import type { MemoryItemType, SignalKind } from "../types";

/** Identifier of a canonical signal. Names reflect SSOT D.5.1 rows. */
export type SignalId =
  | "onboarding_direct_answer"
  | "check_in_text"
  | "reflection_text"
  | "journal_entry"
  | "trigger_tags"
  | "self_discovery_completion"
  | "self_discovery_interp"
  | "practice_better"
  | "practice_worse"
  | "yes_that_fits"
  | "not_quite"
  | "not_anymore"
  | "hide"
  | "like"
  | "dislike"
  | "regenerate"
  | "echo_save";

export interface SignalDefinition {
  id: SignalId;
  /** Starting confidence for items created directly from this signal. */
  base_confidence?: number;
  /** Additive evidence delta applied to existing items. */
  evidence_delta?: number;
  /** Positive corroboration delta for truth-linked outcomes. */
  corroboration_delta?: number;
  /** Negative contradiction delta for truth-linked outcomes. */
  contradiction_delta?: number;
  /** Dedicated delta for explicit user confirmation / reject. */
  delta?: number;
  /** Style / resonance-only delta; NEVER affects truth state. */
  resonance_delta?: number;
  /** Truth delta for engagement-only completions. */
  truth_delta?: number;
  /** Engagement delta (non-truth) for self-discovery completion, etc. */
  engagement_delta?: number;
  /** Transition side-effect expressed as `status->X`. */
  transition?: `status->${"re_check" | "stale"}`;
  /** Visibility-only side-effect: does not change truth. */
  effect?: "visibility_only";
  /** Semantic class of this signal — used for audit and state rules. */
  signal_kind?: SignalKind;
  /** Types this signal alone can create/upgrade. Empty = none. */
  can_upgrade: MemoryItemType[];
  /** Whether this signal is admissible as `truth_confirmation` path. */
  is_truth_path: boolean;
}

const entries: Record<SignalId, SignalDefinition> = {
  onboarding_direct_answer: {
    id: "onboarding_direct_answer",
    base_confidence: 0.85,
    signal_kind: "declaration",
    can_upgrade: [
      "immutable_fact",
      "declared_preference",
      "declared_boundary",
    ],
    is_truth_path: true,
  },
  check_in_text: {
    id: "check_in_text",
    evidence_delta: 0.15,
    signal_kind: "corroboration",
    can_upgrade: ["observation", "hypothesis"],
    is_truth_path: false,
  },
  reflection_text: {
    id: "reflection_text",
    evidence_delta: 0.2,
    signal_kind: "corroboration",
    can_upgrade: ["hypothesis"],
    is_truth_path: false,
  },
  journal_entry: {
    id: "journal_entry",
    evidence_delta: 0.1,
    signal_kind: "corroboration",
    can_upgrade: [],
    is_truth_path: false,
  },
  trigger_tags: {
    id: "trigger_tags",
    evidence_delta: 0.1,
    signal_kind: "corroboration",
    can_upgrade: ["observation"],
    is_truth_path: false,
  },
  self_discovery_completion: {
    id: "self_discovery_completion",
    truth_delta: 0,
    engagement_delta: 0.6,
    signal_kind: "corroboration",
    can_upgrade: [],
    is_truth_path: false,
  },
  self_discovery_interp: {
    id: "self_discovery_interp",
    base_confidence: 0.25,
    signal_kind: "corroboration",
    can_upgrade: [],
    is_truth_path: false,
  },
  practice_better: {
    id: "practice_better",
    corroboration_delta: 0.2,
    signal_kind: "corroboration",
    can_upgrade: [],
    is_truth_path: true,
  },
  practice_worse: {
    id: "practice_worse",
    contradiction_delta: -0.2,
    signal_kind: "contradiction",
    can_upgrade: [],
    is_truth_path: true,
  },
  yes_that_fits: {
    id: "yes_that_fits",
    delta: 0.25,
    signal_kind: "truth_confirmation",
    can_upgrade: ["confirmed_insight"],
    is_truth_path: true,
  },
  not_quite: {
    id: "not_quite",
    delta: -0.15,
    transition: "status->re_check",
    signal_kind: "contradiction",
    can_upgrade: [],
    is_truth_path: true,
  },
  not_anymore: {
    id: "not_anymore",
    transition: "status->stale",
    signal_kind: "contradiction",
    can_upgrade: [],
    is_truth_path: true,
  },
  hide: {
    id: "hide",
    effect: "visibility_only",
    can_upgrade: [],
    is_truth_path: false,
  },
  like: {
    id: "like",
    resonance_delta: 0.05,
    signal_kind: "resonance",
    can_upgrade: [],
    is_truth_path: false,
  },
  dislike: {
    id: "dislike",
    resonance_delta: -0.05,
    signal_kind: "resonance",
    can_upgrade: [],
    is_truth_path: false,
  },
  regenerate: {
    id: "regenerate",
    resonance_delta: -0.05,
    signal_kind: "resonance",
    can_upgrade: [],
    is_truth_path: false,
  },
  echo_save: {
    id: "echo_save",
    resonance_delta: 0.05,
    signal_kind: "resonance",
    can_upgrade: [],
    is_truth_path: false,
  },
};

export const SIGNAL_REGISTRY: Readonly<Record<SignalId, SignalDefinition>> =
  Object.freeze(entries);

export function getSignal(id: SignalId): SignalDefinition {
  return SIGNAL_REGISTRY[id];
}

/**
 * SSOT D.5.3: Memory item may be promoted to `confirmed_insight` ONLY
 * via a truth-confirmation path. Resonance-only signals never upgrade
 * truth. Used as a shared guardrail by state transitions.
 */
export function canSignalUpgradeToConfirmedInsight(id: SignalId): boolean {
  const sig = SIGNAL_REGISTRY[id];
  return sig.is_truth_path && sig.can_upgrade.includes("confirmed_insight");
}

/**
 * SSOT D.5.4: weak-signal limits.
 * - A single `Like` never creates a memory item.
 * - Three consecutive `Echo save` on similar themes MAY create at most
 *   an `observation` about style resonance (not truth).
 * - Read/skip of a summary is not a signal at all.
 *
 * The first rule is encoded as `createsMemoryItem`: only signals with
 * either `base_confidence` or a truth-path are allowed to create new
 * items on their own.
 */
export function canSignalCreateMemoryItem(id: SignalId): boolean {
  const sig = SIGNAL_REGISTRY[id];
  if (sig.base_confidence !== undefined) return true;
  return sig.is_truth_path && sig.can_upgrade.length > 0;
}

/**
 * SSOT D.5.4 second rule: `Echo save` repeated ≥ 3 times on similar
 * themes may create an `observation` about style resonance only.
 */
export const ECHO_SAVE_OBSERVATION_MIN_REPETITIONS = 3;
