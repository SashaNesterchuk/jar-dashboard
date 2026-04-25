import { describe, expect, it, vi } from "vitest";
import type { AIAdapter, SafetyResult } from "../../adapters/ai";
import type { TelemetryAdapter } from "../../adapters/telemetry";
import { fixedClock } from "../../adapters/portal/systemClock";
import {
  CLASSIFIER_LATENCY_BUDGET_MS,
  runSafetyClassifier,
} from "../classifier";

function fakeAI(impl: AIAdapter["runSafetyClassifier"]): AIAdapter {
  return {
    generateSmartSummary: async () => {
      throw new Error("unused");
    },
    generateEnrichment: async () => {
      throw new Error("unused");
    },
    runSafetyClassifier: impl,
  };
}

function fakeTelemetry(): TelemetryAdapter & {
  calls: Array<{ event: string; payload?: unknown }>;
} {
  const calls: Array<{ event: string; payload?: unknown }> = [];
  return {
    capture: (event: string, payload?: unknown) => {
      calls.push({ event, payload });
    },
    calls,
  } as unknown as ReturnType<typeof fakeTelemetry>;
}

describe("runSafetyClassifier — SSOT F.1", () => {
  it("returns the adapter result when within budget", async () => {
    const telemetry = fakeTelemetry();
    const ai = fakeAI(async () => ({
      flag: "none",
      reason: "ok",
      suggested_action: "regenerate",
      classifier_latency_ms: 10,
    }));

    const { result, timed_out } = await runSafetyClassifier({
      ai,
      clock: fixedClock(new Date("2026-04-19T12:00:00Z")),
      telemetry,
      input: { text: "hello", avoided_topics: [], user_state: {} },
      surface: "smart_summary",
      user_id: "u1",
      session_id: "s1",
      output_for_hash: "hello",
    });
    expect(result.flag).toBe("none");
    expect(timed_out).toBe(false);
    expect(telemetry.calls).toHaveLength(1);
    expect(telemetry.calls[0].event).toBe("safety_classifier_completed");
  });

  it("returns safe-template when the classifier exceeds the hard timeout", async () => {
    vi.useFakeTimers();
    const ai = fakeAI(
      () =>
        new Promise<SafetyResult>((resolve) =>
          setTimeout(
            () =>
              resolve({
                flag: "none",
                reason: "ok",
                suggested_action: "regenerate",
                classifier_latency_ms: CLASSIFIER_LATENCY_BUDGET_MS + 100,
              }),
            CLASSIFIER_LATENCY_BUDGET_MS + 100,
          ),
        ),
    );

    const promise = runSafetyClassifier({
      ai,
      clock: fixedClock(new Date("2026-04-19T12:00:00Z")),
      input: { text: "hello", avoided_topics: [], user_state: {} },
      surface: "smart_summary",
      user_id: "u1",
      session_id: null,
      output_for_hash: "hello",
    });

    await vi.advanceTimersByTimeAsync(CLASSIFIER_LATENCY_BUDGET_MS + 10);
    const { result, timed_out } = await promise;
    expect(timed_out).toBe(true);
    expect(result.suggested_action).toBe("safe_template");
    expect(result.reason).toBe("classifier_timeout");
    vi.useRealTimers();
  });

  it("returns hard + safe_template when adapter throws", async () => {
    const ai = fakeAI(async () => {
      throw new Error("model down");
    });
    const { result, timed_out } = await runSafetyClassifier({
      ai,
      clock: fixedClock(new Date("2026-04-19T12:00:00Z")),
      input: { text: "hello", avoided_topics: [], user_state: {} },
      surface: "smart_summary",
      user_id: "u1",
      session_id: null,
      output_for_hash: "hello",
    });
    expect(timed_out).toBe(false);
    expect(result.flag).toBe("hard");
    expect(result.suggested_action).toBe("safe_template");
    expect(result.flag).not.toBe("none");
  });
});
