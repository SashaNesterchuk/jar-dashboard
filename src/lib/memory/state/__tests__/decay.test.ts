import { describe, expect, it } from "vitest";
import { daysBetween, freshnessScore, halfLifeDaysFor } from "../decay";
import { HALF_LIFE_DAYS } from "../../constants";

// Assertions reflect SSOT D.4.4.

const DAY_MS = 24 * 60 * 60 * 1000;

describe("half-life table (SSOT D.4.4)", () => {
  it("matches canonical values", () => {
    expect(HALF_LIFE_DAYS.immutable_fact).toBe(null);
    expect(HALF_LIFE_DAYS.declared_preference).toBe(120);
    expect(HALF_LIFE_DAYS.declared_boundary).toBe(null);
    expect(HALF_LIFE_DAYS.temporary_constraint).toBe(30);
    expect(HALF_LIFE_DAYS.observation).toBe(14);
    expect(HALF_LIFE_DAYS.hypothesis).toBe(10);
    expect(HALF_LIFE_DAYS.confirmed_insight).toBe(60);
  });

  it("halfLifeDaysFor exposes the same map", () => {
    expect(halfLifeDaysFor("hypothesis")).toBe(10);
    expect(halfLifeDaysFor("immutable_fact")).toBe(null);
  });
});

describe("freshnessScore (SSOT D.4.4)", () => {
  const base = new Date("2026-04-19T00:00:00Z");

  it("is exactly 1 at zero elapsed time", () => {
    expect(freshnessScore("hypothesis", base, base)).toBe(1);
  });

  it("is exactly 0.5 after one half-life", () => {
    const laterHypothesis = new Date(base.getTime() + 10 * DAY_MS);
    expect(freshnessScore("hypothesis", base, laterHypothesis)).toBeCloseTo(
      0.5,
      10,
    );

    const laterObservation = new Date(base.getTime() + 14 * DAY_MS);
    expect(freshnessScore("observation", base, laterObservation)).toBeCloseTo(
      0.5,
      10,
    );

    const laterInsight = new Date(base.getTime() + 60 * DAY_MS);
    expect(freshnessScore("confirmed_insight", base, laterInsight)).toBeCloseTo(
      0.5,
      10,
    );
  });

  it("is exactly 0.25 after two half-lives", () => {
    const later = new Date(base.getTime() + 20 * DAY_MS);
    expect(freshnessScore("hypothesis", base, later)).toBeCloseTo(0.25, 10);
  });

  it("is 1 for types with no automatic decay", () => {
    const farFuture = new Date(base.getTime() + 3650 * DAY_MS);
    expect(freshnessScore("immutable_fact", base, farFuture)).toBe(1);
    expect(freshnessScore("declared_boundary", base, farFuture)).toBe(1);
  });

  it("never returns values outside [0, 1]", () => {
    const farFuture = new Date(base.getTime() + 3650 * DAY_MS);
    const score = freshnessScore("hypothesis", base, farFuture);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);

    // "now" before lastSupportedAt should clamp to 1 (no negative days).
    const before = new Date(base.getTime() - 100 * DAY_MS);
    expect(freshnessScore("hypothesis", base, before)).toBe(1);
  });

  it("is monotonically non-increasing as time passes", () => {
    const t1 = new Date(base.getTime() + 1 * DAY_MS);
    const t2 = new Date(base.getTime() + 2 * DAY_MS);
    const t3 = new Date(base.getTime() + 5 * DAY_MS);
    const a = freshnessScore("observation", base, t1);
    const b = freshnessScore("observation", base, t2);
    const c = freshnessScore("observation", base, t3);
    expect(a).toBeGreaterThanOrEqual(b);
    expect(b).toBeGreaterThanOrEqual(c);
  });
});

describe("daysBetween", () => {
  it("computes fractional-day deltas correctly", () => {
    const a = new Date("2026-04-19T00:00:00Z");
    const b = new Date("2026-04-20T12:00:00Z");
    expect(daysBetween(a, b)).toBeCloseTo(1.5, 10);
  });
});
