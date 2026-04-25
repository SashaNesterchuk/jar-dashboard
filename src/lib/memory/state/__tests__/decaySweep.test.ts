import { describe, expect, it } from "vitest";
import { sweepDecay } from "../decaySweep";
import { daysBefore, makeItem, withType } from "../../__tests__/fixtures";

const NOW = new Date("2026-05-19T12:00:00Z");

describe("sweepDecay (SSOT D.2.2 + D.4)", () => {
  it("returns empty result when nothing to sweep", () => {
    const r = sweepDecay({ items: [], now: NOW });
    expect(r.items).toEqual([]);
    expect(r.audits).toEqual([]);
    expect(r.transitions).toEqual([]);
  });

  it("transitions low-confidence hypotheses to stale with paired audit", () => {
    const old = withType(
      makeItem({
        id: "old",
        confidence: 0.2,
        last_supported_at: daysBefore(NOW, 60).toISOString(),
        status: "active",
      }),
      "hypothesis",
    );
    const r = sweepDecay({ items: [old], now: NOW });
    expect(r.items.length).toBe(1);
    expect(r.items[0].status).toBe("stale");
    expect(r.audits.length).toBe(1);
    expect(r.audits[0].action).toBe("correction");
    expect(r.transitions[0]?.to_status).toBe("stale");
  });

  it("leaves immutable facts untouched", () => {
    const fact = withType(
      makeItem({
        id: "fact",
        confidence: 1,
        last_supported_at: daysBefore(NOW, 365).toISOString(),
      }),
      "immutable_fact",
    );
    const r = sweepDecay({ items: [fact], now: NOW });
    expect(r.transitions).toEqual([]);
  });

  it("does not re-transition already-stale items", () => {
    const stale = withType(
      makeItem({
        id: "stale",
        confidence: 0.2,
        status: "stale",
        last_supported_at: daysBefore(NOW, 90).toISOString(),
      }),
      "hypothesis",
    );
    const r = sweepDecay({ items: [stale], now: NOW });
    expect(r.transitions).toEqual([]);
  });
});
