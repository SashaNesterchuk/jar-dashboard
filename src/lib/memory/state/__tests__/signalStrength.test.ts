import { describe, expect, it } from "vitest";
import { computeSignalStrength } from "../signalStrength";

// SSOT D.2.2 signal_strength formula.

describe("computeSignalStrength (SSOT D.2.2)", () => {
  it("returns 0 for all-zero inputs", () => {
    expect(
      computeSignalStrength({
        text_session_factor: 0,
        explicit_user_signal_factor: 0,
        cross_source_agreement: 0,
        recency_factor: 0,
      }),
    ).toBe(0);
  });

  it("returns 1 for all-max inputs", () => {
    expect(
      computeSignalStrength({
        text_session_factor: 1,
        explicit_user_signal_factor: 1,
        cross_source_agreement: 1,
        recency_factor: 1,
      }),
    ).toBeCloseTo(1, 10);
  });

  it("matches the canonical 0.4/0.3/0.2/0.1 weighting", () => {
    expect(
      computeSignalStrength({
        text_session_factor: 1,
        explicit_user_signal_factor: 0,
        cross_source_agreement: 0,
        recency_factor: 0,
      }),
    ).toBeCloseTo(0.4, 10);
    expect(
      computeSignalStrength({
        text_session_factor: 0,
        explicit_user_signal_factor: 1,
        cross_source_agreement: 0,
        recency_factor: 0,
      }),
    ).toBeCloseTo(0.3, 10);
    expect(
      computeSignalStrength({
        text_session_factor: 0,
        explicit_user_signal_factor: 0,
        cross_source_agreement: 1,
        recency_factor: 0,
      }),
    ).toBeCloseTo(0.2, 10);
    expect(
      computeSignalStrength({
        text_session_factor: 0,
        explicit_user_signal_factor: 0,
        cross_source_agreement: 0,
        recency_factor: 1,
      }),
    ).toBeCloseTo(0.1, 10);
  });

  it("clamps out-of-range inputs into [0, 1]", () => {
    const score = computeSignalStrength({
      text_session_factor: 2,
      explicit_user_signal_factor: -1,
      cross_source_agreement: 0.5,
      recency_factor: 0.5,
    });
    // Expected: 0.4 * 1 + 0.3 * 0 + 0.2 * 0.5 + 0.1 * 0.5 = 0.55
    expect(score).toBeCloseTo(0.55, 10);
  });
});
