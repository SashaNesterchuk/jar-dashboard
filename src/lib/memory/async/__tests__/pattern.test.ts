import { describe, expect, it } from "vitest";
import {
  detectObservationToHypothesisPatterns,
  eligiblePatterns,
} from "../pattern";
import { makeItem, withType, withSource, makeSource } from "../../__tests__/fixtures";

const NOW = new Date("2026-04-19T12:00:00Z");

function makeObservationItem(
  id: string,
  theme: string,
  daysAgo: number,
  strength: number,
) {
  const ts = new Date(NOW.getTime() - daysAgo * 24 * 3600 * 1000);
  const base = withType(
    makeItem({
      id,
      theme_tags: [theme],
      last_supported_at: ts.toISOString(),
      confidence: strength,
    }),
    "observation",
  );
  return withSource(
    base,
    makeSource({
      source_event_id: `src_${id}`,
      timestamp: ts.toISOString(),
      weight: strength,
      signal_kind: "corroboration",
    }),
  );
}

describe("pattern.detectObservationToHypothesisPatterns", () => {
  it("flags theme with 3 observations ≥0.4 avg strength in 14d", () => {
    const observations = [
      makeObservationItem("o1", "sleep", 1, 0.5),
      makeObservationItem("o2", "sleep", 5, 0.5),
      makeObservationItem("o3", "sleep", 10, 0.5),
    ];
    const results = detectObservationToHypothesisPatterns({
      observations,
      now: NOW,
    });
    const sleep = results.find((r) => r.theme_tag === "sleep");
    expect(sleep?.verdict.eligible).toBe(true);
    expect(sleep?.verdict.meta?.matched).toBe(3);
  });

  it("does NOT flag theme with only 2 observations", () => {
    const observations = [
      makeObservationItem("o1", "focus", 1, 0.5),
      makeObservationItem("o2", "focus", 2, 0.5),
    ];
    const [only] = eligiblePatterns(
      detectObservationToHypothesisPatterns({
        observations,
        now: NOW,
      }),
    );
    expect(only).toBeUndefined();
  });

  it("does NOT flag theme with low avg strength", () => {
    const observations = [
      makeObservationItem("o1", "mood", 1, 0.1),
      makeObservationItem("o2", "mood", 5, 0.1),
      makeObservationItem("o3", "mood", 10, 0.1),
    ];
    const [only] = eligiblePatterns(
      detectObservationToHypothesisPatterns({
        observations,
        now: NOW,
      }),
    );
    expect(only).toBeUndefined();
  });

  it("ignores observations older than 14 days", () => {
    const observations = [
      makeObservationItem("o1", "old", 20, 0.9),
      makeObservationItem("o2", "old", 21, 0.9),
      makeObservationItem("o3", "old", 22, 0.9),
    ];
    const [only] = eligiblePatterns(
      detectObservationToHypothesisPatterns({
        observations,
        now: NOW,
      }),
    );
    expect(only).toBeUndefined();
  });
});
