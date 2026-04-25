import { describe, expect, it } from "vitest";
import {
  diversityBonus,
  intentMatchScore,
  recencyScore,
  recomputeActiveConfidence,
  relevanceScore,
  sourceReliability,
} from "../relevance";
import {
  daysBefore,
  makeItem,
  makeSource,
  withSource,
  withType,
} from "../../__tests__/fixtures";

const NOW = new Date("2026-04-19T12:00:00Z");

describe("relevance.intentMatchScore", () => {
  it("returns 0 when no theme_tags match", () => {
    const item = makeItem({ theme_tags: ["sleep"] });
    const score = intentMatchScore(item, { theme_tags: ["focus"] });
    expect(score).toBe(0);
  });

  it("scores cosine similarity of theme tags", () => {
    const item = makeItem({ theme_tags: ["sleep", "energy"] });
    const score = intentMatchScore(item, {
      theme_tags: ["sleep", "focus"],
    });
    // intersection 1 / sqrt(2)*sqrt(2) = 0.5
    expect(score).toBeCloseTo(0.5, 3);
  });

  it("adds focus-area bonus when cosine is below 1", () => {
    const item = makeItem({
      theme_tags: ["sleep", "energy"],
      related_focus_areas: ["rest"],
    });
    const withBonus = intentMatchScore(item, {
      theme_tags: ["sleep", "focus"],
      focus_areas: ["rest"],
    });
    const withoutBonus = intentMatchScore(item, {
      theme_tags: ["sleep", "focus"],
    });
    expect(withBonus).toBeGreaterThan(withoutBonus);
    expect(withBonus).toBeLessThanOrEqual(1);
  });
});

describe("relevance.recencyScore", () => {
  it("scores 1 at now", () => {
    expect(recencyScore(NOW, NOW)).toBe(1);
  });
  it("scores 0.5 at 14 days old (half-life)", () => {
    const ts = daysBefore(NOW, 14);
    expect(recencyScore(ts, NOW)).toBeCloseTo(0.5, 2);
  });
  it("stays within [0, 1]", () => {
    const ts = daysBefore(NOW, 365);
    const s = recencyScore(ts, NOW);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe("relevance.sourceReliability", () => {
  it("falls back to 0.5 without sources", () => {
    const item = makeItem({ sources: [] });
    expect(sourceReliability(item)).toBe(0.5);
  });
  it("picks the strongest source by weight", () => {
    const item = withSource(
      withSource(makeItem({ sources: [] }), makeSource({
        source_type: "echo_save",
        weight: 0.9,
      })),
      makeSource({ source_type: "onboarding", weight: 1.0 }),
    );
    expect(sourceReliability(item)).toBe(1.0);
  });
});

describe("relevance.diversityBonus", () => {
  it("returns 1 for first pick", () => {
    const item = makeItem({ theme_tags: ["a", "b"] });
    expect(diversityBonus(item, [])).toBe(1);
  });
  it("returns 0 when themes already selected", () => {
    const a = makeItem({ id: "a", theme_tags: ["x"] });
    const b = makeItem({ id: "b", theme_tags: ["x"] });
    expect(diversityBonus(b, [a])).toBe(0);
  });
  it("partial novelty returns fraction", () => {
    const a = makeItem({ id: "a", theme_tags: ["x"] });
    const b = makeItem({ id: "b", theme_tags: ["x", "y"] });
    expect(diversityBonus(b, [a])).toBeCloseTo(0.5, 3);
  });
});

describe("relevance.recomputeActiveConfidence", () => {
  it("is always recomputed from clock (SSOT D.4.3)", () => {
    // A confirmed_insight item with 60-day half-life:
    const item = withType(
      makeItem({
        type: "hypothesis",
        confidence: 0.8,
        active_confidence: 0.8, // stale cached value
        freshness_score: 1,
        last_supported_at: daysBefore(NOW, 10).toISOString(),
      }),
      "hypothesis",
    );

    // Hypothesis half-life is 10 days (SSOT D.4.4).
    const liveNow = recomputeActiveConfidence(item, NOW);
    expect(liveNow).toBeCloseTo(0.4, 2); // 0.8 * 0.5

    // Advance the clock another 10 days → should halve again.
    const later = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
    const liveLater = recomputeActiveConfidence(item, later);
    expect(liveLater).toBeCloseTo(0.2, 2);
    expect(liveLater).toBeLessThan(liveNow);
  });
});

describe("relevance.relevanceScore", () => {
  it("combines weights per SSOT E.6.1", () => {
    const item = withSource(
      makeItem({
        confidence: 1,
        freshness_score: 1,
        last_supported_at: NOW.toISOString(),
        theme_tags: ["x"],
        related_focus_areas: [],
      }),
      makeSource({ source_type: "onboarding", weight: 1 }),
    );
    const breakdown = relevanceScore(
      item,
      { theme_tags: ["x"] },
      [],
      NOW,
    );
    expect(breakdown.active_confidence).toBeCloseTo(1, 3);
    expect(breakdown.recency_score).toBeCloseTo(1, 3);
    expect(breakdown.source_reliability).toBeCloseTo(1, 3);
    expect(breakdown.intent_match_score).toBeCloseTo(1, 3);
    expect(breakdown.diversity_bonus).toBeCloseTo(1, 3);
    // sum of weights = 1 → total = 1 when all signals 1
    expect(breakdown.total).toBeCloseTo(1, 3);
  });
});
