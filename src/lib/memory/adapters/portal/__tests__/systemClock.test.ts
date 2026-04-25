import { describe, expect, it } from "vitest";
import { fixedClock, systemClock } from "../systemClock";

describe("ClockAdapter portal implementations (Spec §3.5)", () => {
  it("systemClock returns a Date close to wall-clock now", () => {
    const before = Date.now();
    const n = systemClock.now().getTime();
    const after = Date.now();
    expect(n).toBeGreaterThanOrEqual(before);
    expect(n).toBeLessThanOrEqual(after);
  });

  it("fixedClock returns cloned Date (never mutable by callers)", () => {
    const frozen = new Date("2026-04-19T00:00:00Z");
    const clock = fixedClock(frozen);
    const a = clock.now();
    const b = clock.now();
    expect(a).not.toBe(b); // distinct instances
    expect(a.getTime()).toBe(b.getTime());
    a.setFullYear(2000);
    expect(clock.now().getFullYear()).toBe(2026);
  });
});
