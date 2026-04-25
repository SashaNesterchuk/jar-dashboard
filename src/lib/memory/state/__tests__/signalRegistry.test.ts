import { describe, expect, it } from "vitest";
import {
  SIGNAL_REGISTRY,
  canSignalCreateMemoryItem,
  canSignalUpgradeToConfirmedInsight,
  getSignal,
} from "../signalRegistry";

// All assertions reflect SSOT D.5.1 / D.5.3 / D.5.4.

describe("SIGNAL_REGISTRY (SSOT D.5.1)", () => {
  it("onboarding_direct_answer has base_confidence 0.85 and is a declaration", () => {
    const sig = getSignal("onboarding_direct_answer");
    expect(sig.base_confidence).toBe(0.85);
    expect(sig.signal_kind).toBe("declaration");
    expect(sig.can_upgrade).toEqual([
      "immutable_fact",
      "declared_preference",
      "declared_boundary",
    ]);
  });

  it("check-in / reflection / journal evidence deltas are exact", () => {
    expect(SIGNAL_REGISTRY.check_in_text.evidence_delta).toBe(0.15);
    expect(SIGNAL_REGISTRY.reflection_text.evidence_delta).toBe(0.2);
    expect(SIGNAL_REGISTRY.journal_entry.evidence_delta).toBe(0.1);
    expect(SIGNAL_REGISTRY.trigger_tags.evidence_delta).toBe(0.1);
  });

  it("self_discovery_completion has engagement_delta 0.6 and truth_delta 0", () => {
    const sig = getSignal("self_discovery_completion");
    expect(sig.engagement_delta).toBe(0.6);
    expect(sig.truth_delta).toBe(0);
    expect(sig.is_truth_path).toBe(false);
  });

  it("self_discovery_interp base_confidence is 0.25", () => {
    expect(getSignal("self_discovery_interp").base_confidence).toBe(0.25);
  });

  it("practice_better and practice_worse are symmetric ±0.2", () => {
    expect(SIGNAL_REGISTRY.practice_better.corroboration_delta).toBe(0.2);
    expect(SIGNAL_REGISTRY.practice_worse.contradiction_delta).toBe(-0.2);
  });

  it("explicit truth signals have exact deltas and transitions", () => {
    expect(SIGNAL_REGISTRY.yes_that_fits.delta).toBe(0.25);
    expect(SIGNAL_REGISTRY.yes_that_fits.signal_kind).toBe(
      "truth_confirmation",
    );
    expect(SIGNAL_REGISTRY.not_quite.delta).toBe(-0.15);
    expect(SIGNAL_REGISTRY.not_quite.transition).toBe("status->re_check");
    expect(SIGNAL_REGISTRY.not_anymore.transition).toBe("status->stale");
  });

  it("hide is visibility-only (not a truth signal)", () => {
    const sig = getSignal("hide");
    expect(sig.effect).toBe("visibility_only");
    expect(sig.is_truth_path).toBe(false);
  });

  it("resonance signals (like/dislike/regenerate/echo_save) carry ±0.05 resonance delta only", () => {
    for (const id of ["like", "echo_save"] as const) {
      expect(SIGNAL_REGISTRY[id].resonance_delta).toBe(0.05);
      expect(SIGNAL_REGISTRY[id].signal_kind).toBe("resonance");
      expect(SIGNAL_REGISTRY[id].is_truth_path).toBe(false);
    }
    for (const id of ["dislike", "regenerate"] as const) {
      expect(SIGNAL_REGISTRY[id].resonance_delta).toBe(-0.05);
      expect(SIGNAL_REGISTRY[id].signal_kind).toBe("resonance");
      expect(SIGNAL_REGISTRY[id].is_truth_path).toBe(false);
    }
  });
});

describe("resonance vs truth guardrails (SSOT D.5.3)", () => {
  it("no resonance signal can upgrade to confirmed_insight", () => {
    for (const id of ["like", "dislike", "regenerate", "echo_save"] as const) {
      expect(canSignalUpgradeToConfirmedInsight(id)).toBe(false);
    }
  });

  it("yes_that_fits is the only registry entry that can upgrade to confirmed_insight", () => {
    const upgraders = Object.values(SIGNAL_REGISTRY).filter((s) =>
      canSignalUpgradeToConfirmedInsight(s.id),
    );
    expect(upgraders.map((s) => s.id)).toEqual(["yes_that_fits"]);
  });
});

describe("weak-signal guardrails (SSOT D.5.4)", () => {
  it("a single Like never creates a memory item", () => {
    expect(canSignalCreateMemoryItem("like")).toBe(false);
  });

  it("echo_save alone cannot create a memory item (must be aggregated)", () => {
    expect(canSignalCreateMemoryItem("echo_save")).toBe(false);
  });

  it("onboarding answers and yes_that_fits CAN create / upgrade items", () => {
    expect(canSignalCreateMemoryItem("onboarding_direct_answer")).toBe(true);
    expect(canSignalCreateMemoryItem("yes_that_fits")).toBe(true);
  });

  it("hide is not an item-creating signal", () => {
    expect(canSignalCreateMemoryItem("hide")).toBe(false);
  });
});
