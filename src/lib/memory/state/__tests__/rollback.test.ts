import { describe, expect, it } from "vitest";
import { canRollback, isWithinRollbackWindow } from "../rollback";
import type { MemoryAuditEvent } from "../../types";

const NOW = new Date("2026-04-19T00:00:00Z");
const HOUR = 60 * 60 * 1000;

function makeAudit(
  overrides: Partial<MemoryAuditEvent> = {},
): MemoryAuditEvent {
  return {
    event_id: "evt",
    memory_item_id: "item_1",
    action: "soft_reject",
    user_id: "u",
    timestamp: new Date(NOW.getTime() - 1 * HOUR).toISOString(),
    previous_state: {
      confidence: 0.6,
      status: "active",
      user_feedback_state: "none",
      visibility_scope: "memory_screen",
    },
    new_state: {
      confidence: 0.45,
      status: "re_check",
      user_feedback_state: "rejected_by_user",
      visibility_scope: "memory_screen",
    },
    context_surface: "memory_screen",
    source_event_id: null,
    ...overrides,
  };
}

describe("rollback (SSOT D.2.4)", () => {
  it("isWithinRollbackWindow is true at 23h, false at 25h", () => {
    expect(
      isWithinRollbackWindow(
        makeAudit({
          timestamp: new Date(NOW.getTime() - 23 * HOUR).toISOString(),
        }),
        NOW,
      ),
    ).toBe(true);
    expect(
      isWithinRollbackWindow(
        makeAudit({
          timestamp: new Date(NOW.getTime() - 25 * HOUR).toISOString(),
        }),
        NOW,
      ),
    ).toBe(false);
  });

  it("isWithinRollbackWindow is true exactly at 24h boundary", () => {
    expect(
      isWithinRollbackWindow(
        makeAudit({
          timestamp: new Date(NOW.getTime() - 24 * HOUR).toISOString(),
        }),
        NOW,
      ),
    ).toBe(true);
  });

  it("canRollback restores previous state within window for soft_reject", () => {
    const audit = makeAudit();
    const v = canRollback(audit, NOW);
    expect(v.allowed).toBe(true);
    expect(v.restore?.confidence).toBe(0.6);
    expect(v.restore?.status).toBe("active");
    expect(v.restore?.user_feedback_state).toBe("none");
  });

  it("canRollback denies after 24h", () => {
    const audit = makeAudit({
      timestamp: new Date(NOW.getTime() - 25 * HOUR).toISOString(),
    });
    const v = canRollback(audit, NOW);
    expect(v.allowed).toBe(false);
    expect(v.restore).toBeUndefined();
  });

  it("canRollback denies non-revertible actions (confirm / why_query)", () => {
    expect(canRollback(makeAudit({ action: "confirm" }), NOW).allowed).toBe(false);
    expect(canRollback(makeAudit({ action: "why_query" }), NOW).allowed).toBe(false);
    expect(canRollback(makeAudit({ action: "correction" }), NOW).allowed).toBe(false);
  });

  it("canRollback allows mark_stale and hide", () => {
    expect(canRollback(makeAudit({ action: "mark_stale" }), NOW).allowed).toBe(true);
    expect(canRollback(makeAudit({ action: "hide" }), NOW).allowed).toBe(true);
  });
});
