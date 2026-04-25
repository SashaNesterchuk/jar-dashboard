import { describe, expect, it } from "vitest";
import {
  countTruthUpgradeSignals,
  evaluateConfirmedInsightToReCheck,
  evaluateHypothesisToConfirmedInsight,
  evaluateHypothesisToStale,
  evaluateObservationToHypothesis,
  evaluateReCheckToConfirmedInsight,
  evaluateReCheckToStale,
  evaluateStaleToHypothesisRevival,
  evaluateTransitionsForItem,
} from "../transitions";
import {
  addStateHistoryEntry,
  daysBefore,
  makeCorroboration,
  makeEvidence,
  makeItem,
  makeLike,
  makeNotQuite,
  makeObservation,
  makeYesThatFits,
  TEST_ITEM_ID,
  withType,
} from "../../__tests__/fixtures";

const NOW = new Date("2026-04-19T00:00:00Z");

// --------------------------------------------------------------------
// observation → hypothesis (SSOT D.2.2)
// --------------------------------------------------------------------

describe("observation → hypothesis (SSOT D.2.2)", () => {
  it("requires >= 3 consistent observations in 14-day window", () => {
    const obs = [
      makeObservation({ id: "o1", timestamp: daysBefore(NOW, 1), signal_strength: 0.5 }),
      makeObservation({ id: "o2", timestamp: daysBefore(NOW, 5), signal_strength: 0.5 }),
    ];
    const v = evaluateObservationToHypothesis(obs, "recovery", NOW);
    expect(v.eligible).toBe(false);
    expect(v.meta?.matched).toBe(2);
  });

  it("ignores observations outside the 14-day window", () => {
    const obs = [
      makeObservation({ id: "o1", timestamp: daysBefore(NOW, 1), signal_strength: 0.5 }),
      makeObservation({ id: "o2", timestamp: daysBefore(NOW, 5), signal_strength: 0.5 }),
      makeObservation({ id: "o3", timestamp: daysBefore(NOW, 20), signal_strength: 0.9 }),
    ];
    const v = evaluateObservationToHypothesis(obs, "recovery", NOW);
    expect(v.eligible).toBe(false);
    expect(v.meta?.matched).toBe(2);
  });

  it("requires avg signal_strength >= 0.4", () => {
    const obs = [
      makeObservation({ id: "o1", timestamp: daysBefore(NOW, 1), signal_strength: 0.3 }),
      makeObservation({ id: "o2", timestamp: daysBefore(NOW, 5), signal_strength: 0.3 }),
      makeObservation({ id: "o3", timestamp: daysBefore(NOW, 10), signal_strength: 0.3 }),
    ];
    const v = evaluateObservationToHypothesis(obs, "recovery", NOW);
    expect(v.eligible).toBe(false);
    expect(v.meta?.avg_signal_strength).toBeCloseTo(0.3, 10);
  });

  it("promotes when 3+ observations, in window, avg >= 0.4", () => {
    const obs = [
      makeObservation({ id: "o1", timestamp: daysBefore(NOW, 1), signal_strength: 0.4 }),
      makeObservation({ id: "o2", timestamp: daysBefore(NOW, 5), signal_strength: 0.5 }),
      makeObservation({ id: "o3", timestamp: daysBefore(NOW, 10), signal_strength: 0.6 }),
    ];
    const v = evaluateObservationToHypothesis(obs, "recovery", NOW);
    expect(v.eligible).toBe(true);
    expect(v.meta?.matched).toBe(3);
    expect(v.meta?.avg_signal_strength).toBeCloseTo(0.5, 10);
  });

  it("filters observations by theme_tag", () => {
    const obs = [
      makeObservation({ id: "o1", theme_tag: "recovery", timestamp: daysBefore(NOW, 1), signal_strength: 0.5 }),
      makeObservation({ id: "o2", theme_tag: "sleep", timestamp: daysBefore(NOW, 2), signal_strength: 0.5 }),
      makeObservation({ id: "o3", theme_tag: "recovery", timestamp: daysBefore(NOW, 3), signal_strength: 0.5 }),
    ];
    const v = evaluateObservationToHypothesis(obs, "recovery", NOW);
    expect(v.meta?.matched).toBe(2);
    expect(v.eligible).toBe(false);
  });
});

// --------------------------------------------------------------------
// hypothesis → confirmed_insight (SSOT D.2.2, two paths)
// --------------------------------------------------------------------

describe("hypothesis → confirmed_insight (SSOT D.2.2)", () => {
  it("path A: 2× yes_that_fits within 30 days and no contradictions → confirmed", () => {
    const item = makeItem();
    const signals = [
      makeYesThatFits(daysBefore(NOW, 5)),
      makeYesThatFits(daysBefore(NOW, 15)),
    ];
    const v = evaluateHypothesisToConfirmedInsight(item, signals, NOW);
    expect(v.eligible).toBe(true);
    expect(v.meta?.path).toBe("A");
  });

  it("path A: confirmations outside 30d window are ignored", () => {
    const item = makeItem();
    const signals = [
      makeYesThatFits(daysBefore(NOW, 5)),
      makeYesThatFits(daysBefore(NOW, 35)),
    ];
    const v = evaluateHypothesisToConfirmedInsight(item, signals, NOW);
    expect(v.eligible).toBe(false);
    expect(v.meta?.confirmations_in_30d).toBe(1);
  });

  it("path A blocked by explicit contradiction in same window", () => {
    const item = makeItem();
    const signals = [
      makeYesThatFits(daysBefore(NOW, 5)),
      makeYesThatFits(daysBefore(NOW, 15)),
      makeNotQuite(daysBefore(NOW, 20)),
    ];
    const v = evaluateHypothesisToConfirmedInsight(item, signals, NOW);
    expect(v.eligible).toBe(false);
    expect(v.meta?.has_contradiction_in_window).toBe(true);
  });

  it("path B: 1× yes_that_fits + 2 corroborations within 21 days → confirmed", () => {
    const item = makeItem();
    const signals = [
      makeYesThatFits(daysBefore(NOW, 3)),
      makeCorroboration(daysBefore(NOW, 7)),
      makeCorroboration(daysBefore(NOW, 14)),
    ];
    const v = evaluateHypothesisToConfirmedInsight(item, signals, NOW);
    expect(v.eligible).toBe(true);
    expect(v.meta?.path).toBe("B");
  });

  it("path B blocked when only 1 corroboration", () => {
    const item = makeItem();
    const signals = [
      makeYesThatFits(daysBefore(NOW, 3)),
      makeCorroboration(daysBefore(NOW, 7)),
    ];
    const v = evaluateHypothesisToConfirmedInsight(item, signals, NOW);
    expect(v.eligible).toBe(false);
  });

  it("guardrail (D.5.3): 100× like never promotes to confirmed_insight", () => {
    const item = makeItem();
    const signals = Array.from({ length: 100 }, (_, i) =>
      makeLike(daysBefore(NOW, i % 20)),
    );
    const v = evaluateHypothesisToConfirmedInsight(item, signals, NOW);
    expect(v.eligible).toBe(false);
    expect(countTruthUpgradeSignals(signals, TEST_ITEM_ID)).toBe(0);
  });

  it("rejects non-hypothesis items", () => {
    const item = withType(makeItem(), "observation");
    const signals = [
      makeYesThatFits(daysBefore(NOW, 5)),
      makeYesThatFits(daysBefore(NOW, 15)),
    ];
    const v = evaluateHypothesisToConfirmedInsight(item, signals, NOW);
    expect(v.eligible).toBe(false);
  });
});

// --------------------------------------------------------------------
// hypothesis → stale (SSOT D.2.2)
// --------------------------------------------------------------------

describe("hypothesis → stale (SSOT D.2.2)", () => {
  it("stales when no supporting signal for > 30 days", () => {
    const item = makeItem({
      last_supported_at: daysBefore(NOW, 31).toISOString(),
    });
    const v = evaluateHypothesisToStale(item, [], NOW);
    expect(v.eligible).toBe(true);
    expect(v.meta?.rule).toBe("no_support");
  });

  it("stales after 2× not_quite (soft reject)", () => {
    const item = makeItem();
    const signals = [
      makeNotQuite(daysBefore(NOW, 2)),
      makeNotQuite(daysBefore(NOW, 5)),
    ];
    const v = evaluateHypothesisToStale(item, signals, NOW);
    expect(v.eligible).toBe(true);
    expect(v.meta?.rule).toBe("soft_reject");
  });

  it("does NOT stale with only 1 not_quite", () => {
    const item = makeItem();
    const signals = [makeNotQuite(daysBefore(NOW, 2))];
    const v = evaluateHypothesisToStale(item, signals, NOW);
    expect(v.eligible).toBe(false);
  });

  it("stales when confidence < 0.25 (decay)", () => {
    const item = makeItem({ confidence: 0.2 });
    const v = evaluateHypothesisToStale(item, [], NOW);
    expect(v.eligible).toBe(true);
    expect(v.meta?.rule).toBe("confidence_decay");
  });
});

// --------------------------------------------------------------------
// confirmed_insight → re_check (SSOT D.2.2)
// --------------------------------------------------------------------

describe("confirmed_insight → re_check (SSOT D.2.2)", () => {
  const base = () => makeItem({ type: "confirmed_insight", confidence: 0.8 });

  it("triggers on a single not_quite", () => {
    const item = base();
    const v = evaluateConfirmedInsightToReCheck(
      item,
      [makeNotQuite(daysBefore(NOW, 1))],
      NOW,
    );
    expect(v.eligible).toBe(true);
    expect(v.meta?.rule).toBe("not_quite");
  });

  it("triggers on 3 contradicting behavior signals in 14 days", () => {
    const item = base();
    const signals = [
      makeEvidence({
        event_id: "c1",
        signal_id: "practice_worse",
        signal_kind: "contradiction",
        timestamp: daysBefore(NOW, 1),
      }),
      makeEvidence({
        event_id: "c2",
        signal_id: "practice_worse",
        signal_kind: "contradiction",
        timestamp: daysBefore(NOW, 6),
      }),
      makeEvidence({
        event_id: "c3",
        signal_id: "practice_worse",
        signal_kind: "contradiction",
        timestamp: daysBefore(NOW, 12),
      }),
    ];
    const v = evaluateConfirmedInsightToReCheck(item, signals, NOW);
    expect(v.eligible).toBe(true);
    expect(v.meta?.rule).toBe("behavioral_contradiction");
  });

  it("does not trigger with 2 contradictions", () => {
    const item = base();
    const signals = [
      makeEvidence({
        event_id: "c1",
        signal_id: "practice_worse",
        signal_kind: "contradiction",
        timestamp: daysBefore(NOW, 1),
      }),
      makeEvidence({
        event_id: "c2",
        signal_id: "practice_worse",
        signal_kind: "contradiction",
        timestamp: daysBefore(NOW, 6),
      }),
    ];
    const v = evaluateConfirmedInsightToReCheck(item, signals, NOW);
    expect(v.eligible).toBe(false);
  });

  it("triggers on post-pause recalibration flag", () => {
    const item = base();
    const v = evaluateConfirmedInsightToReCheck(item, [], NOW, {
      recalibration_shows_contradiction: true,
    });
    expect(v.eligible).toBe(true);
    expect(v.meta?.rule).toBe("post_pause_recalibration");
  });
});

// --------------------------------------------------------------------
// re_check → confirmed_insight (SSOT D.2.2)
// --------------------------------------------------------------------

describe("re_check → confirmed_insight (SSOT D.2.2)", () => {
  it("restores on 2× yes_that_fits within 14 days", () => {
    const item = addStateHistoryEntry(
      makeItem({ type: "confirmed_insight" }),
      "re_check",
      daysBefore(NOW, 5),
    );
    const signals = [
      makeYesThatFits(daysBefore(NOW, 2)),
      makeYesThatFits(daysBefore(NOW, 4)),
    ];
    const v = evaluateReCheckToConfirmedInsight(item, signals, NOW);
    expect(v.eligible).toBe(true);
    expect(v.meta?.confirmations_in_14d).toBe(2);
  });

  it("ignores confirmations older than 14 days", () => {
    const item = addStateHistoryEntry(
      makeItem({ type: "confirmed_insight" }),
      "re_check",
      daysBefore(NOW, 20),
    );
    const signals = [
      makeYesThatFits(daysBefore(NOW, 2)),
      makeYesThatFits(daysBefore(NOW, 20)),
    ];
    const v = evaluateReCheckToConfirmedInsight(item, signals, NOW);
    expect(v.eligible).toBe(false);
  });

  it("rejects items not in re_check", () => {
    const item = makeItem({ type: "confirmed_insight", status: "active" });
    const v = evaluateReCheckToConfirmedInsight(
      item,
      [
        makeYesThatFits(daysBefore(NOW, 2)),
        makeYesThatFits(daysBefore(NOW, 4)),
      ],
      NOW,
    );
    expect(v.eligible).toBe(false);
  });
});

// --------------------------------------------------------------------
// re_check → stale (SSOT D.2.2)
// --------------------------------------------------------------------

describe("re_check → stale (SSOT D.2.2)", () => {
  it("stales on not_anymore", () => {
    const item = addStateHistoryEntry(
      makeItem({ type: "confirmed_insight" }),
      "re_check",
      daysBefore(NOW, 2),
    );
    const signals = [
      makeEvidence({
        event_id: "na",
        signal_id: "not_anymore",
        signal_kind: "contradiction",
        timestamp: daysBefore(NOW, 1),
      }),
    ];
    const v = evaluateReCheckToStale(item, signals, NOW);
    expect(v.eligible).toBe(true);
    expect(v.meta?.rule).toBe("not_anymore");
  });

  it("stales after 14 days without resolution", () => {
    const item = addStateHistoryEntry(
      makeItem({ type: "confirmed_insight" }),
      "re_check",
      daysBefore(NOW, 15),
    );
    const v = evaluateReCheckToStale(item, [], NOW);
    expect(v.eligible).toBe(true);
    expect(v.meta?.rule).toBe("no_resolution");
  });

  it("does not stale within the 14-day window without explicit reject", () => {
    const item = addStateHistoryEntry(
      makeItem({ type: "confirmed_insight" }),
      "re_check",
      daysBefore(NOW, 5),
    );
    const v = evaluateReCheckToStale(item, [], NOW);
    expect(v.eligible).toBe(false);
  });
});

// --------------------------------------------------------------------
// stale → hypothesis revival (SSOT D.2.2)
// --------------------------------------------------------------------

describe("stale → hypothesis revival (SSOT D.2.2)", () => {
  const staleItem = () =>
    addStateHistoryEntry(
      makeItem({ type: "hypothesis" }),
      "stale",
      daysBefore(NOW, 10),
    );

  it("is NEVER automatic in P0/P0b (manual flag required)", () => {
    const observations = [
      makeObservation({ id: "o1", timestamp: daysBefore(NOW, 1) }),
      makeObservation({ id: "o2", timestamp: daysBefore(NOW, 2) }),
      makeObservation({ id: "o3", timestamp: daysBefore(NOW, 3) }),
    ];
    const v = evaluateStaleToHypothesisRevival(staleItem(), observations, {
      manual_revival_flag: false,
    });
    expect(v.eligible).toBe(false);
    expect(v.meta?.automatic_allowed).toBe(false);
    expect(v.meta?.manual_flag).toBe(false);
  });

  it("eligible when 3 new observations AND manual flag set", () => {
    const observations = [
      makeObservation({ id: "o1", timestamp: daysBefore(NOW, 1) }),
      makeObservation({ id: "o2", timestamp: daysBefore(NOW, 2) }),
      makeObservation({ id: "o3", timestamp: daysBefore(NOW, 3) }),
    ];
    const v = evaluateStaleToHypothesisRevival(staleItem(), observations, {
      manual_revival_flag: true,
    });
    expect(v.eligible).toBe(true);
  });

  it("blocked when < 3 observations even with manual flag", () => {
    const observations = [
      makeObservation({ id: "o1", timestamp: daysBefore(NOW, 1) }),
      makeObservation({ id: "o2", timestamp: daysBefore(NOW, 2) }),
    ];
    const v = evaluateStaleToHypothesisRevival(staleItem(), observations, {
      manual_revival_flag: true,
    });
    expect(v.eligible).toBe(false);
  });
});

// --------------------------------------------------------------------
// Composite evaluator
// --------------------------------------------------------------------

describe("evaluateTransitionsForItem", () => {
  it("returns hypothesis outgoing transitions only for active hypothesis", () => {
    const item = makeItem();
    const verdicts = evaluateTransitionsForItem(item, {
      signals: [],
      now: NOW,
    });
    const names = verdicts.map((v) => v.transition).sort();
    expect(names).toEqual([
      "hypothesis_to_confirmed_insight",
      "hypothesis_to_stale",
    ]);
  });

  it("returns re_check outgoing transitions when item is confirmed_insight in re_check", () => {
    const item = addStateHistoryEntry(
      makeItem({ type: "confirmed_insight" }),
      "re_check",
      daysBefore(NOW, 1),
    );
    const verdicts = evaluateTransitionsForItem(item, {
      signals: [],
      now: NOW,
    });
    const names = verdicts.map((v) => v.transition).sort();
    expect(names).toEqual([
      "re_check_to_confirmed_insight",
      "re_check_to_stale",
    ]);
  });

  it("returns revival verdict when item is stale and observations provided", () => {
    const item = addStateHistoryEntry(
      makeItem({ type: "hypothesis" }),
      "stale",
      daysBefore(NOW, 5),
    );
    const verdicts = evaluateTransitionsForItem(item, {
      signals: [],
      now: NOW,
      observations_for_revival: [
        makeObservation({ id: "o1" }),
        makeObservation({ id: "o2" }),
        makeObservation({ id: "o3" }),
      ],
      manual_revival_flag: true,
    });
    expect(verdicts.map((v) => v.transition)).toEqual([
      "stale_to_hypothesis_revival",
    ]);
    expect(verdicts[0].eligible).toBe(true);
  });
});
