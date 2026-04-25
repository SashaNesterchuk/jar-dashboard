import { describe, expect, it } from "vitest";
import {
  applyFeedback,
  persistFeedback,
} from "../apply";
import { InMemoryStorageAdapter } from "../../adapters/portal/inMemoryStorage";
import type { MemoryAuditEvent, MemoryItem } from "../../types";
import {
  makeItem,
  makeYesThatFits,
  TEST_USER_ID,
  withType,
} from "../../__tests__/fixtures";

const NOW = new Date("2026-04-19T12:00:00Z");

function seed(item: MemoryItem): {
  storage: InMemoryStorageAdapter;
  item: MemoryItem;
} {
  const storage = new InMemoryStorageAdapter({ storage: null });
  const audit: MemoryAuditEvent = {
    event_id: "bootstrap",
    memory_item_id: item.id,
    action: "correction",
    user_id: item.user_id,
    timestamp: NOW.toISOString(),
    previous_state: { confidence: item.confidence, status: item.status },
    new_state: { confidence: item.confidence, status: item.status },
    context_surface: "memory_screen",
    source_event_id: null,
  };
  storage.upsertMemoryItem(item, audit);
  return { storage, item };
}

describe("feedback.applyFeedback", () => {
  it("yes_that_fits → confirmed_by_user, +0.25", () => {
    const item = withType(
      makeItem({ confidence: 0.3, id: "apply_yes" }),
      "hypothesis",
    );
    const res = applyFeedback({
      item,
      action: "yes_that_fits",
      now: NOW,
    });
    expect(res.item.confidence).toBeCloseTo(0.55);
    expect(res.item.user_feedback_state).toBe("confirmed_by_user");
  });

  it("not_quite → re_check + -0.15", () => {
    const item = withType(
      makeItem({ confidence: 0.6, id: "apply_nq" }),
      "confirmed_insight",
    );
    const res = applyFeedback({ item, action: "not_quite", now: NOW });
    expect(res.item.status).toBe("re_check");
    expect(res.item.confidence).toBeCloseTo(0.45);
  });

  it("not_anymore → stale + marked_stale_by_user", () => {
    const item = withType(
      makeItem({ confidence: 0.5, id: "apply_na" }),
      "confirmed_insight",
    );
    const res = applyFeedback({ item, action: "not_anymore", now: NOW });
    expect(res.item.status).toBe("stale");
    expect(res.item.user_feedback_state).toBe("marked_stale_by_user");
  });

  it("hide → visibility_scope hidden, truth unchanged", () => {
    const item = withType(
      makeItem({ confidence: 0.6, id: "apply_hide" }),
      "confirmed_insight",
    );
    const res = applyFeedback({ item, action: "hide", now: NOW });
    expect(res.item.visibility_scope).toBe("hidden");
    expect(res.item.confidence).toBeCloseTo(0.6);
    expect(res.item.status).toBe("active");
  });
});

describe("feedback.persistFeedback", () => {
  it("writes item + audit to storage atomically", async () => {
    const { storage, item } = seed(
      withType(
        makeItem({ id: "pf1", confidence: 0.4 }),
        "hypothesis",
      ),
    );
    const res = await persistFeedback(
      { storage },
      {
        item,
        action: "yes_that_fits",
        now: NOW,
      },
    );

    const items = await storage.getMemoryItems(TEST_USER_ID);
    const updated = items.find((i) => i.id === item.id);
    expect(updated?.confidence).toBeCloseTo(0.65);

    const audits = await storage.getAuditTrail(item.id);
    expect(audits.map((a) => a.event_id)).toContain(res.audit.event_id);
  });

  it("2× yes_that_fits on hypothesis → confirmed_insight (DoD)", async () => {
    const { storage, item } = seed(
      withType(
        makeItem({ id: "pf2", confidence: 0.45 }),
        "hypothesis",
      ),
    );

    // First confirmation (earlier)
    const firstTime = new Date(NOW.getTime() - 5 * 24 * 3600 * 1000);
    const first = await persistFeedback(
      { storage },
      { item, action: "yes_that_fits", now: firstTime },
    );
    expect(first.item.type).toBe("hypothesis");
    expect(first.transition).toBeNull();

    // Second confirmation — with prior signal so the evaluator sees 2 in window.
    const prior = [
      makeYesThatFits(firstTime, { memory_item_id: item.id }),
    ];
    const second = await persistFeedback(
      { storage },
      {
        item: first.item,
        action: "yes_that_fits",
        now: NOW,
        prior_signals: prior,
      },
    );
    expect(second.item.type).toBe("confirmed_insight");
    expect(second.transition).toBe("hypothesis_to_confirmed_insight");
  });
});
