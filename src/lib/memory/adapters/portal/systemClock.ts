/**
 * Portal implementation of `ClockAdapter` — wall-clock time.
 * Spec §3.5.
 */

import type { ClockAdapter } from "../clock";

export const systemClock: ClockAdapter = {
  now(): Date {
    return new Date();
  },
};

/**
 * Factory for deterministic test clocks. Not used in production code;
 * unit tests in pure-core already accept `now: Date` directly, but
 * higher-level tests that go through the Provider may need a frozen
 * clock.
 */
export function fixedClock(value: Date): ClockAdapter {
  return { now: () => new Date(value.getTime()) };
}
