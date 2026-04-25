import { describe, expect, it } from "vitest";
import {
  computeActiveConfidence,
  computeUserConfidenceScore,
  resolveConfidenceLevel,
} from "../confidence";
import {
  ACTIVE_CONFIDENCE_INSIGHT_MIN,
  ACTIVE_CONFIDENCE_NO_SOFTENER,
  ACTIVE_CONFIDENCE_RETRIEVAL_MIN,
} from "../../constants";
import type { ConfidenceScoreInputs } from "../../types";

// Assertions reflect SSOT D.4.1 / D.4.2 / D.4.3.

const ZERO_INPUTS: ConfidenceScoreInputs = {
  total_sessions: 0,
  text_sessions_ratio: 0,
  confirmed_signals_count: 0,
  contradicted_signals_count: 0,
  days_active_in_last_14: 0,
  source_diversity: 0,
  avg_freshness: 0,
};

function logRatio(value: number, base: number): number {
  return Math.log10(Math.max(value, 0) + 1) / Math.log10(base);
}

describe("computeUserConfidenceScore (SSOT D.4.1)", () => {
  it("returns 0 for an all-zero input", () => {
    expect(computeUserConfidenceScore(ZERO_INPUTS)).toBe(0);
  });

  it("clamps to [0, 1] even with extreme inputs", () => {
    const huge: ConfidenceScoreInputs = {
      total_sessions: 1_000_000,
      text_sessions_ratio: 1,
      confirmed_signals_count: 1_000_000,
      contradicted_signals_count: 0,
      days_active_in_last_14: 14,
      source_diversity: 8,
      avg_freshness: 1,
    };
    expect(computeUserConfidenceScore(huge)).toBe(1);

    const heavyContradiction: ConfidenceScoreInputs = {
      ...ZERO_INPUTS,
      contradicted_signals_count: 1_000_000,
    };
    expect(computeUserConfidenceScore(heavyContradiction)).toBe(0);
  });

  it("reproduces the canonical formula term-by-term", () => {
    const inputs: ConfidenceScoreInputs = {
      total_sessions: 10,
      text_sessions_ratio: 0.5,
      confirmed_signals_count: 4,
      contradicted_signals_count: 1,
      days_active_in_last_14: 7,
      source_diversity: 4,
      avg_freshness: 0.5,
    };

    const expected =
      0.15 * logRatio(inputs.total_sessions, 20) +
      0.2 * inputs.text_sessions_ratio +
      0.25 * logRatio(inputs.confirmed_signals_count, 10) -
      0.15 * logRatio(inputs.contradicted_signals_count, 10) +
      0.15 * (inputs.days_active_in_last_14 / 14) +
      0.1 * (inputs.source_diversity / 8) +
      0.1 * inputs.avg_freshness;

    expect(computeUserConfidenceScore(inputs)).toBeCloseTo(expected, 10);
  });

  it("contradictions reduce the score", () => {
    const baseline: ConfidenceScoreInputs = {
      total_sessions: 10,
      text_sessions_ratio: 0.5,
      confirmed_signals_count: 4,
      contradicted_signals_count: 0,
      days_active_in_last_14: 7,
      source_diversity: 4,
      avg_freshness: 0.5,
    };
    const withContradictions: ConfidenceScoreInputs = {
      ...baseline,
      contradicted_signals_count: 5,
    };
    expect(computeUserConfidenceScore(withContradictions)).toBeLessThan(
      computeUserConfidenceScore(baseline),
    );
  });
});

describe("resolveConfidenceLevel (SSOT D.4.2)", () => {
  it("returns A for a fresh user (score < 0.20)", () => {
    expect(resolveConfidenceLevel(0.1, ZERO_INPUTS)).toBe("A");
  });

  it("returns A when total_sessions < 2 even if score nominally allows B", () => {
    const inputs: ConfidenceScoreInputs = {
      ...ZERO_INPUTS,
      total_sessions: 1,
      text_sessions_ratio: 1,
    };
    // Score in B range but total_sessions<2 → A (D.4.2 definition of A).
    expect(resolveConfidenceLevel(0.3, inputs)).toBe("A");
  });

  it("returns B when score in [0.20, 0.45) and B-conditions satisfied", () => {
    const inputs: ConfidenceScoreInputs = {
      ...ZERO_INPUTS,
      total_sessions: 4,
      text_sessions_ratio: 0.4,
    };
    expect(resolveConfidenceLevel(0.3, inputs)).toBe("B");
  });

  it("falls back to A if B-conditions not met (total_sessions < 3)", () => {
    const inputs: ConfidenceScoreInputs = {
      ...ZERO_INPUTS,
      total_sessions: 2,
      text_sessions_ratio: 0.4,
    };
    expect(resolveConfidenceLevel(0.3, inputs)).toBe("A");
  });

  it("falls back to A if B-conditions not met (text_sessions_ratio < 0.3)", () => {
    const inputs: ConfidenceScoreInputs = {
      ...ZERO_INPUTS,
      total_sessions: 5,
      text_sessions_ratio: 0.2,
    };
    expect(resolveConfidenceLevel(0.3, inputs)).toBe("A");
  });

  it("returns C when score in [0.45, 0.70) and C-conditions satisfied", () => {
    const inputs: ConfidenceScoreInputs = {
      total_sessions: 10,
      text_sessions_ratio: 0.6,
      confirmed_signals_count: 3,
      contradicted_signals_count: 0,
      days_active_in_last_14: 5,
      source_diversity: 3,
      avg_freshness: 0.6,
    };
    expect(resolveConfidenceLevel(0.5, inputs)).toBe("C");
  });

  it("returns D when score >= 0.70 and D-conditions satisfied", () => {
    const inputs: ConfidenceScoreInputs = {
      total_sessions: 40,
      text_sessions_ratio: 0.8,
      confirmed_signals_count: 10,
      contradicted_signals_count: 0,
      days_active_in_last_14: 12,
      source_diversity: 5,
      avg_freshness: 0.9,
    };
    expect(resolveConfidenceLevel(0.8, inputs)).toBe("D");
  });

  it("walks down from a high preferred level to the first satisfied level", () => {
    // Score is in D range but confirmed_signals_count (6) blocks D.
    // C conditions are satisfied → should resolve to C.
    const inputs: ConfidenceScoreInputs = {
      total_sessions: 30,
      text_sessions_ratio: 0.7,
      confirmed_signals_count: 6,
      contradicted_signals_count: 0,
      days_active_in_last_14: 10,
      source_diversity: 3,
      avg_freshness: 0.8,
    };
    // Score geometrically in D range, but not >= D.max_score_exclusive
    // so we test both branches deterministically:
    expect(resolveConfidenceLevel(0.85, inputs)).toBe("C");
  });

  it("never returns a level above A when min conditions fail at every level", () => {
    const inputs: ConfidenceScoreInputs = {
      ...ZERO_INPUTS,
      total_sessions: 1, // blocks B
    };
    expect(resolveConfidenceLevel(0.99, inputs)).toBe("A");
  });
});

describe("computeActiveConfidence (SSOT D.4.3)", () => {
  it("equals confidence * freshness_score", () => {
    expect(computeActiveConfidence(0.8, 0.5)).toBeCloseTo(0.4, 10);
    expect(computeActiveConfidence(0.5, 1)).toBe(0.5);
    expect(computeActiveConfidence(0, 1)).toBe(0);
  });

  it("clamps both inputs to [0, 1]", () => {
    expect(computeActiveConfidence(1.5, 0.5)).toBe(0.5);
    expect(computeActiveConfidence(-0.3, 0.5)).toBe(0);
    expect(computeActiveConfidence(0.8, 2)).toBe(0.8);
  });

  it("threshold constants match SSOT D.4.3", () => {
    expect(ACTIVE_CONFIDENCE_RETRIEVAL_MIN).toBe(0.3);
    expect(ACTIVE_CONFIDENCE_INSIGHT_MIN).toBe(0.5);
    expect(ACTIVE_CONFIDENCE_NO_SOFTENER).toBe(0.7);
  });
});
