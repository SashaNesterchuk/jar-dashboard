/**
 * Source-of-truth resolution on conflicting signals / items — SSOT D.2.3.
 *
 * Rules (applied top-to-bottom, first match wins):
 * 1. User explicit statement (onboarding / correction / chat statement)
 *    vs inferred observation → explicit user statement wins.
 * 2. User `Yes, that fits` vs later `Not quite` on the same item →
 *    explicit contradiction moves item to re_check. This is NOT a
 *    silent overwrite — it is a state transition; captured here as a
 *    `contradiction_moves_to_re_check` verdict.
 * 3. Behavioral pattern vs stated preference → declared preference stays
 *    canonical; behavior logged as a tension signal.
 * 4. Echo save / Like vs explicit correction → explicit correction wins.
 * 5. Two contradicting hypotheses → newer AND stronger evidence wins;
 *    if neither dominates, raise `retrieval_contradiction`
 *    (SSOT E.6.4) for later review (P1).
 *
 * This module is pure. Actually emitting `retrieval_contradiction`
 * telemetry is the retrieval layer's job (EPIC 4).
 */

import type { MemoryItem, SourceType } from "../types";

export type ConflictRuleId =
  | "explicit_over_inferred"
  | "yes_then_not_quite"
  | "declared_over_behavioral"
  | "correction_over_resonance"
  | "newer_stronger_hypothesis"
  | "mutual_unresolved";

export interface ConflictResolution {
  winner: "a" | "b" | "mutual";
  loser: "a" | "b" | null;
  rule: ConflictRuleId;
  /** True when the resolution triggers E.6.4 `retrieval_contradiction`. */
  retrieval_contradiction: boolean;
  /** True when the resolution triggers a state transition to re_check. */
  triggers_re_check: boolean;
  /** True when a declared preference beats behavior — behavior must be logged as a tension signal. */
  log_tension_signal: boolean;
  reason: string;
}

const EXPLICIT_STATEMENT_SOURCES: ReadonlySet<SourceType> = new Set([
  "onboarding",
  "memory_screen",
  "reflection",
  "check_in_text",
  "self_discovery",
]);

const BEHAVIORAL_SOURCES: ReadonlySet<SourceType> = new Set([
  "pattern_detection",
  "practice_feedback",
  "echo_save",
]);

const RESONANCE_SOURCES: ReadonlySet<SourceType> = new Set(["echo_save"]);

function hasExplicitStatement(item: MemoryItem): boolean {
  // Declarations (immutable_fact, declared_*) are explicit by
  // construction, plus any item whose most recent source carries a
  // `declaration` or `truth_confirmation` signal kind.
  if (
    item.type === "immutable_fact" ||
    item.type === "declared_preference" ||
    item.type === "declared_boundary" ||
    item.type === "temporary_constraint"
  ) {
    return true;
  }
  return item.sources.some(
    (s) =>
      EXPLICIT_STATEMENT_SOURCES.has(s.source_type) &&
      (s.signal_kind === "declaration" || s.signal_kind === "truth_confirmation"),
  );
}

function isInferredObservation(item: MemoryItem): boolean {
  return item.type === "observation" || item.type === "hypothesis";
}

function hasYesThatFits(item: MemoryItem): { present: boolean; lastAt: Date | null } {
  let last: Date | null = null;
  for (const s of item.sources) {
    if (s.signal_kind === "truth_confirmation") {
      const ts = new Date(s.timestamp);
      if (!last || ts > last) last = ts;
    }
  }
  return { present: last !== null, lastAt: last };
}

function hasNotQuiteAfter(item: MemoryItem, after: Date | null): boolean {
  if (!after) return false;
  return item.sources.some(
    (s) =>
      s.signal_kind === "contradiction" &&
      new Date(s.timestamp).getTime() > after.getTime(),
  );
}

function isResonanceOnly(item: MemoryItem): boolean {
  // Every recorded source is resonance / behavior-only; no declaration
  // and no truth_confirmation.
  return (
    item.sources.length > 0 &&
    item.sources.every(
      (s) =>
        s.signal_kind === "resonance" ||
        (RESONANCE_SOURCES.has(s.source_type) && s.signal_kind !== "truth_confirmation"),
    )
  );
}

function hasCorrection(item: MemoryItem): boolean {
  // A memory_screen-sourced correction is encoded as
  // source_type='memory_screen'. Any source with signal_kind
  // 'contradiction' OR 'declaration' from memory_screen counts as an
  // explicit correction per D.2.3 row 4.
  return item.sources.some(
    (s) =>
      s.source_type === "memory_screen" &&
      (s.signal_kind === "contradiction" ||
        s.signal_kind === "declaration" ||
        s.signal_kind === "truth_confirmation"),
  );
}

function isBehavioralOnly(item: MemoryItem): boolean {
  return (
    item.sources.length > 0 &&
    item.sources.every((s) => BEHAVIORAL_SOURCES.has(s.source_type))
  );
}

function isDeclaredPreference(item: MemoryItem): boolean {
  return item.type === "declared_preference";
}

/**
 * Resolve a pairwise conflict according to D.2.3.
 *
 * `a` and `b` are two candidate memory items we are about to surface
 * together and which carry contradictory claims. The caller is
 * responsible for detecting the contradiction itself — this function
 * only picks a winner.
 */
export function resolveConflict(a: MemoryItem, b: MemoryItem): ConflictResolution {
  // Rules are applied from most-specific to least-specific. Rule 1
  // (generic explicit-over-inferred) is the fallback because several
  // specific rules (2, 3, 4) would otherwise be shadowed by it when
  // both items contain declaration/truth_confirmation sources.

  // Rule 2: Yes that fits followed by later Not quite on the SAME item
  // — moves that item to re_check (SSOT D.2.3 row 2). Checked first
  // because the pattern lives inside a single item regardless of what
  // the other item is.
  for (const [id, x] of [["a", a], ["b", b]] as const) {
    const yes = hasYesThatFits(x);
    if (yes.present && hasNotQuiteAfter(x, yes.lastAt)) {
      return pack(
        id === "a" ? "b" : "a",
        id,
        "yes_then_not_quite",
        false,
        true,
        false,
        "later Not quite contradicts prior Yes that fits — move to re_check",
      );
    }
  }

  // Rule 3: declared preference vs behavioral-only pattern
  // (SSOT D.2.3 row 3). Declared stays canonical; behavior logged as
  // a tension signal (not dropped).
  if (isDeclaredPreference(a) && isBehavioralOnly(b)) {
    return pack("a", "b", "declared_over_behavioral", false, false, true,
      "declared preference stays canonical; behavior logged as tension signal");
  }
  if (isDeclaredPreference(b) && isBehavioralOnly(a)) {
    return pack("b", "a", "declared_over_behavioral", false, false, true,
      "declared preference stays canonical; behavior logged as tension signal");
  }

  // Rule 4: echo save / like vs explicit correction (SSOT D.2.3 row 4).
  if (hasCorrection(a) && isResonanceOnly(b)) {
    return pack("a", "b", "correction_over_resonance", false, false, false,
      "explicit correction beats resonance-only evidence");
  }
  if (hasCorrection(b) && isResonanceOnly(a)) {
    return pack("b", "a", "correction_over_resonance", false, false, false,
      "explicit correction beats resonance-only evidence");
  }

  // Rule 1 (generic): explicit statement over inferred observation
  // (SSOT D.2.3 row 1). Applied after specific rules so it does not
  // shadow them.
  const aExplicit = hasExplicitStatement(a);
  const bExplicit = hasExplicitStatement(b);
  const aInferred = isInferredObservation(a);
  const bInferred = isInferredObservation(b);

  if (aExplicit && bInferred && !bExplicit) {
    return pack("a", "b", "explicit_over_inferred", false, false, false,
      "explicit user statement beats inferred observation");
  }
  if (bExplicit && aInferred && !aExplicit) {
    return pack("b", "a", "explicit_over_inferred", false, false, false,
      "explicit user statement beats inferred observation");
  }

  // Rule 5: two contradicting hypotheses — newer AND stronger.
  if (a.type === "hypothesis" && b.type === "hypothesis") {
    const aConf = a.active_confidence;
    const bConf = b.active_confidence;
    const aTs = new Date(a.last_supported_at).getTime();
    const bTs = new Date(b.last_supported_at).getTime();
    const aStronger = aConf > bConf;
    const bStronger = bConf > aConf;
    const aNewer = aTs > bTs;
    const bNewer = bTs > aTs;

    if (aStronger && aNewer) {
      return pack("a", "b", "newer_stronger_hypothesis", false, false, false,
        "hypothesis A is both newer and stronger");
    }
    if (bStronger && bNewer) {
      return pack("b", "a", "newer_stronger_hypothesis", false, false, false,
        "hypothesis B is both newer and stronger");
    }
    // Otherwise neither dominates unambiguously — mutual contradiction.
    return pack("mutual", null, "mutual_unresolved", true, false, false,
      "two high-confidence contradicting hypotheses; neither dominates");
  }

  // Fallback: mutual contradiction to be surfaced via retrieval
  // contradiction telemetry. We never silently drop one side.
  return pack("mutual", null, "mutual_unresolved", true, false, false,
    "no rule matched unambiguously");
}

function pack(
  winner: ConflictResolution["winner"],
  loser: ConflictResolution["loser"],
  rule: ConflictRuleId,
  retrieval_contradiction: boolean,
  triggers_re_check: boolean,
  log_tension_signal: boolean,
  reason: string,
): ConflictResolution {
  return {
    winner,
    loser,
    rule,
    retrieval_contradiction,
    triggers_re_check,
    log_tension_signal,
    reason,
  };
}

/**
 * Shape of the telemetry signal to be emitted by retrieval (E.6.4).
 * This module only constructs the payload; the TelemetryAdapter in
 * EPIC 3 will actually send it.
 */
export interface RetrievalContradictionEvent {
  type: "retrieval_contradiction";
  item_a_id: string;
  item_b_id: string;
  rule: ConflictRuleId;
  reason: string;
  timestamp: string;
}

export function makeRetrievalContradictionEvent(
  a: MemoryItem,
  b: MemoryItem,
  resolution: ConflictResolution,
  now: Date,
): RetrievalContradictionEvent | null {
  if (!resolution.retrieval_contradiction) return null;
  return {
    type: "retrieval_contradiction",
    item_a_id: a.id,
    item_b_id: b.id,
    rule: resolution.rule,
    reason: resolution.reason,
    timestamp: now.toISOString(),
  };
}
