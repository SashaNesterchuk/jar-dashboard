import { describe, expect, it } from "vitest";
import { computeMemoryCorrectionRate, filterAuditByWindow } from "../metrics";
import type { MemoryAuditAction, MemoryAuditEvent } from "../../types";

function mkAudit(
  action: MemoryAuditAction,
  at: string,
): MemoryAuditEvent {
  return {
    event_id: `${action}_${at}`,
    memory_item_id: "item_1",
    action,
    user_id: "user_1",
    timestamp: at,
    previous_state: { confidence: 0.5, status: "active" },
    new_state: { confidence: 0.4, status: "active" },
    context_surface: "memory_screen",
    source_event_id: null,
  };
}

describe("computeMemoryCorrectionRate (SSOT J.3.2)", () => {
  it("returns null rate when denominator is zero", () => {
    const r = computeMemoryCorrectionRate({
      audit: [],
      items_viewed_on_memory_screen: 0,
    });
    expect(r.rate).toBeNull();
    expect(r.corrections).toBe(0);
  });

  it("counts soft_reject + mark_stale + correction", () => {
    const audit: MemoryAuditEvent[] = [
      mkAudit("soft_reject", "2026-04-19T10:00:00Z"),
      mkAudit("mark_stale", "2026-04-19T11:00:00Z"),
      mkAudit("correction", "2026-04-19T12:00:00Z"),
      mkAudit("confirm", "2026-04-19T13:00:00Z"),
      mkAudit("hide", "2026-04-19T14:00:00Z"),
    ];
    const r = computeMemoryCorrectionRate({
      audit,
      items_viewed_on_memory_screen: 10,
    });
    expect(r.corrections).toBe(3);
    expect(r.rate).toBeCloseTo(0.3, 4);
    expect(r.breakdown.soft_reject).toBe(1);
    expect(r.breakdown.mark_stale).toBe(1);
    expect(r.breakdown.correction).toBe(1);
  });
});

describe("filterAuditByWindow", () => {
  it("filters by inclusive from/to window", () => {
    const audit: MemoryAuditEvent[] = [
      mkAudit("correction", "2026-04-18T12:00:00Z"),
      mkAudit("correction", "2026-04-19T12:00:00Z"),
      mkAudit("correction", "2026-04-20T12:00:00Z"),
    ];
    const out = filterAuditByWindow(audit, {
      from: new Date("2026-04-19T00:00:00Z"),
      to: new Date("2026-04-19T23:59:59Z"),
    });
    expect(out.length).toBe(1);
  });
});
