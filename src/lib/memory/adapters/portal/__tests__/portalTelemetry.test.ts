import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPortalTelemetryAdapter } from "../portalTelemetry";

describe("PortalTelemetryAdapter (Spec §3.4)", () => {
  const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

  beforeEach(() => {
    debugSpy.mockClear();
  });

  afterEach(() => {
    // Keep spy across tests, reset counters only.
  });

  it("is a no-op in production by default (no console, no sink)", () => {
    const adapter = createPortalTelemetryAdapter({ devMode: false });
    adapter.capture("memory_screen_opened", { user_id: "u1" });
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("prints console.debug in dev mode", () => {
    const adapter = createPortalTelemetryAdapter({ devMode: true });
    adapter.capture("memory_feedback_submitted", { item: "x" });
    expect(debugSpy).toHaveBeenCalledWith(
      "[memory.telemetry]",
      "memory_feedback_submitted",
      { item: "x" },
    );
  });

  it("prefers sink over console.debug when provided", () => {
    const sink = vi.fn();
    const adapter = createPortalTelemetryAdapter({
      devMode: true,
      sink,
    });
    adapter.capture("memory.state_transition", { to: "confirmed_insight" });
    expect(sink).toHaveBeenCalledWith("memory.state_transition", {
      to: "confirmed_insight",
    });
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("swallows sink errors so telemetry never breaks the flow", () => {
    const sink = vi.fn(() => {
      throw new Error("boom");
    });
    const adapter = createPortalTelemetryAdapter({ sink, devMode: true });
    expect(() => adapter.capture("session_started")).not.toThrow();
  });

  it("accumulates in-memory history for smoke panels", () => {
    const adapter = createPortalTelemetryAdapter({ devMode: false });
    adapter.capture("session_started");
    adapter.capture("smart_summary_viewed", { id: "s1" });
    expect(adapter.history).toHaveLength(2);
    expect(adapter.history[0].event).toBe("session_started");
    expect(adapter.history[1].payload).toEqual({ id: "s1" });
  });
});
