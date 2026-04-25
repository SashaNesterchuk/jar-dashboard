import { describe, expect, it } from "vitest";
import { computeRollback, persistRollback } from "../correction";
import { applyFeedback } from "../apply";
import { InMemoryStorageAdapter } from "../../adapters/portal/inMemoryStorage";
import type { MemoryAuditEvent } from "../../types";
import { makeItem, TEST_USER_ID, withType } from "../../__tests__/fixtures";

const NOW = new Date("2026-04-19T12:00:00Z");

function seed(confidence: number) {
  const item = withType(
    makeItem({ id: "corr_1", confidence, type: "confirmed_insight" }),
    "confirmed_insight",
  );
  const storage = new InMemoryStorageAdapter({ storage: null });
  const audit: MemoryAuditEvent = {
    event_id: "bootstrap_audit",
    memory_item_id: item.id,
    action: "correction",
    user_id: item.user_id,
    timestamp: NOW.toISOString(),
    previous_state: { confidence, status: "active" },
    new_state: { confidence, status: "active" },
    context_surface: "memory_screen",
    source_event_id: null,
  };
  storage.upsertMemoryItem(item, audit);
  return { storage, item };
}

describe("correction.computeRollback", () => {
  it("restores previous state within 24h window", async () => {
    const { storage, item } = seed(0.6);
    const feedbackTime = new Date(NOW.getTime() - 2 * 3600 * 1000);
    const fb = applyFeedback({
      item,
      action: "not_quite",
      now: feedbackTime,
    });
    await storage.upsertMemoryItem(fb.item, fb.audit);

    const verdict = computeRollback({
      item: fb.item,
      audit: fb.audit,
      now: NOW,
    });
    expect(verdict.allowed).toBe(true);
    expect(verdict.item?.status).toBe("active");
    expect(verdict.item?.confidence).toBeCloseTo(0.6);
    expect(verdict.audit?.action).toBe("correction");
  });

  it("rejects rollback outside 24h window", () => {
    const { item } = seed(0.6);
    const longAgo = new Date(NOW.getTime() - 30 * 3600 * 1000);
    const fb = applyFeedback({ item, action: "not_quite", now: longAgo });

    const verdict = computeRollback({
      item: fb.item,
      audit: fb.audit,
      now: NOW,
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.verdict.reason).toMatch(/outside/);
  });

  it("rejects rollback for non-revertible actions (e.g. confirm)", () => {
    const { item } = seed(0.3);
    const fb = applyFeedback({ item, action: "yes_that_fits", now: NOW });

    const verdict = computeRollback({
      item: fb.item,
      audit: fb.audit,
      now: NOW,
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.verdict.reason).toMatch(/not revertible/);
  });
});

describe("correction.persistRollback", () => {
  it("restores item + writes correction audit", async () => {
    const { storage, item } = seed(0.6);
    const fb = applyFeedback({
      item,
      action: "not_anymore",
      now: new Date(NOW.getTime() - 3600 * 1000),
    });
    await storage.upsertMemoryItem(fb.item, fb.audit);

    const res = await persistRollback(
      { storage },
      { item: fb.item, audit: fb.audit, now: NOW },
    );
    expect(res.allowed).toBe(true);

    const items = await storage.getMemoryItems(TEST_USER_ID);
    const persisted = items.find((i) => i.id === item.id);
    expect(persisted?.status).toBe("active");

    const trail = await storage.getAuditTrail(item.id);
    const hasCorrection = trail.some((a) => a.action === "correction");
    expect(hasCorrection).toBe(true);
  });
});
