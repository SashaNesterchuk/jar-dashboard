import { describe, expect, it } from "vitest";
import {
  makeRetrievalContradictionEvent,
  resolveConflict,
} from "../conflict";
import {
  daysBefore,
  makeItem,
  makeSource,
  withSource,
  withType,
} from "../../__tests__/fixtures";

const NOW = new Date("2026-04-19T00:00:00Z");

describe("resolveConflict (SSOT D.2.3)", () => {
  it("rule 1: explicit user statement beats inferred observation", () => {
    // Explicit: hypothesis with a check_in_text source carrying a
    // truth_confirmation signal_kind. It is "explicit" by source but
    // not a declared_preference, so Rule 3 does not fire.
    const explicit = withType(
      withSource(
        makeItem(),
        makeSource({
          source_type: "check_in_text",
          signal_kind: "truth_confirmation",
          source_event_id: "explicit_evt",
        }),
      ),
      "hypothesis",
    );
    const inferred = withType(
      withSource(
        makeItem({ id: "item_2" }),
        makeSource({
          source_type: "pattern_detection",
          signal_kind: "corroboration",
        }),
      ),
      "observation",
    );
    const r = resolveConflict(explicit, inferred);
    expect(r.rule).toBe("explicit_over_inferred");
    expect(r.winner).toBe("a");
    expect(r.loser).toBe("b");
    expect(r.retrieval_contradiction).toBe(false);
  });

  it("rule 2: Yes that fits followed by Not quite → item moves to re_check", () => {
    const t0 = daysBefore(NOW, 5);
    const t1 = daysBefore(NOW, 1);
    const a = withSource(
      withSource(makeItem(), makeSource({
        source_type: "memory_screen",
        signal_kind: "truth_confirmation",
        timestamp: t0.toISOString(),
        source_event_id: "yes",
      })),
      makeSource({
        source_type: "memory_screen",
        signal_kind: "contradiction",
        timestamp: t1.toISOString(),
        source_event_id: "nq",
      }),
    );
    const b = makeItem({ id: "item_2" });
    const r = resolveConflict(a, b);
    expect(r.rule).toBe("yes_then_not_quite");
    expect(r.triggers_re_check).toBe(true);
    expect(r.loser).toBe("a");
  });

  it("rule 3: declared preference vs behavioral-only pattern — declared wins, tension logged", () => {
    const declared = withType(
      withSource(makeItem(), makeSource({ source_type: "onboarding", signal_kind: "declaration" })),
      "declared_preference",
    );
    const behavior = withSource(
      makeItem({ id: "item_2" }),
      makeSource({ source_type: "pattern_detection", signal_kind: "corroboration" }),
    );
    const r = resolveConflict(declared, behavior);
    expect(r.rule).toBe("declared_over_behavioral");
    expect(r.winner).toBe("a");
    expect(r.log_tension_signal).toBe(true);
  });

  it("rule 4: explicit correction beats echo-save / like resonance", () => {
    const correction = withSource(
      makeItem(),
      makeSource({ source_type: "memory_screen", signal_kind: "contradiction", source_event_id: "corr" }),
    );
    const resonance = withType(
      withSource(
        makeItem({ id: "item_2" }),
        makeSource({ source_type: "echo_save", signal_kind: "resonance", source_event_id: "echo" }),
      ),
      "observation",
    );
    const r = resolveConflict(correction, resonance);
    expect(r.rule).toBe("correction_over_resonance");
    expect(r.winner).toBe("a");
  });

  it("rule 5: two contradicting hypotheses — newer AND stronger wins", () => {
    const older = makeItem({
      id: "h_old",
      type: "hypothesis",
      active_confidence: 0.4,
      last_supported_at: daysBefore(NOW, 30).toISOString(),
    });
    const newer = makeItem({
      id: "h_new",
      type: "hypothesis",
      active_confidence: 0.7,
      last_supported_at: daysBefore(NOW, 2).toISOString(),
    });
    const r = resolveConflict(older, newer);
    expect(r.rule).toBe("newer_stronger_hypothesis");
    expect(r.winner).toBe("b");
    expect(r.loser).toBe("a");
    expect(r.retrieval_contradiction).toBe(false);
  });

  it("rule 5: ambiguous hypotheses (newer-but-weaker vs stronger-but-older) → mutual", () => {
    const strongerOlder = makeItem({
      id: "h_so",
      type: "hypothesis",
      active_confidence: 0.8,
      last_supported_at: daysBefore(NOW, 30).toISOString(),
    });
    const weakerNewer = makeItem({
      id: "h_wn",
      type: "hypothesis",
      active_confidence: 0.5,
      last_supported_at: daysBefore(NOW, 1).toISOString(),
    });
    const r = resolveConflict(strongerOlder, weakerNewer);
    expect(r.rule).toBe("mutual_unresolved");
    expect(r.winner).toBe("mutual");
    expect(r.retrieval_contradiction).toBe(true);
  });
});

describe("makeRetrievalContradictionEvent (SSOT E.6.4)", () => {
  it("returns null when resolution is not mutual", () => {
    const a = withType(
      withSource(makeItem(), makeSource({ source_type: "onboarding", signal_kind: "declaration" })),
      "declared_preference",
    );
    const b = withType(
      withSource(makeItem({ id: "b" }), makeSource({ source_type: "pattern_detection", signal_kind: "corroboration" })),
      "observation",
    );
    const r = resolveConflict(a, b);
    expect(makeRetrievalContradictionEvent(a, b, r, NOW)).toBe(null);
  });

  it("emits event payload on mutual contradiction", () => {
    const a = makeItem({ id: "h_so", type: "hypothesis", active_confidence: 0.8, last_supported_at: daysBefore(NOW, 30).toISOString() });
    const b = makeItem({ id: "h_wn", type: "hypothesis", active_confidence: 0.5, last_supported_at: daysBefore(NOW, 1).toISOString() });
    const r = resolveConflict(a, b);
    const evt = makeRetrievalContradictionEvent(a, b, r, NOW);
    expect(evt).not.toBe(null);
    expect(evt?.type).toBe("retrieval_contradiction");
    expect(evt?.item_a_id).toBe("h_so");
    expect(evt?.item_b_id).toBe("h_wn");
    expect(evt?.rule).toBe("mutual_unresolved");
  });
});
