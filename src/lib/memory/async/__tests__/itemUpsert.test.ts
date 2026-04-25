import { describe, expect, it } from "vitest";
import {
  applySignalToItem,
  persistSignalToItem,
} from "../itemUpsert";
import { InMemoryStorageAdapter } from "../../adapters/portal/inMemoryStorage";
import {
  makeItem,
  makeYesThatFits,
  TEST_USER_ID,
  withType,
} from "../../__tests__/fixtures";

const NOW = new Date("2026-04-19T12:00:00Z");

describe("itemUpsert.applySignalToItem", () => {
  it("yes_that_fits adds +0.25 and sets confirmed_by_user", () => {
    const item = withType(makeItem({ confidence: 0.3 }), "hypothesis");
    const res = applySignalToItem({
      item,
      signal_id: "yes_that_fits",
      now: NOW,
      source_event_id: "evt_1",
      source_type: "memory_screen",
      context_surface: "memory_screen",
    });

    expect(res.applied_delta).toBeCloseTo(0.25);
    expect(res.item.confidence).toBeCloseTo(0.55);
    expect(res.item.user_feedback_state).toBe("confirmed_by_user");
    expect(res.audit.action).toBe("confirm");
    expect(res.audit.previous_state.confidence).toBeCloseTo(0.3);
    expect(res.audit.new_state.confidence).toBeCloseTo(0.55);
    expect(res.item.version).toBe(item.version + 1);
  });

  it("not_quite applies -0.15 and transitions status → re_check", () => {
    const item = withType(
      makeItem({ confidence: 0.5, type: "confirmed_insight" }),
      "confirmed_insight",
    );
    const res = applySignalToItem({
      item,
      signal_id: "not_quite",
      now: NOW,
      source_event_id: "evt_nq",
      source_type: "memory_screen",
      context_surface: "memory_screen",
    });

    expect(res.item.confidence).toBeCloseTo(0.35);
    expect(res.item.status).toBe("re_check");
    expect(res.item.user_feedback_state).toBe("rejected_by_user");
    expect(res.audit.action).toBe("soft_reject");
  });

  it("not_anymore → status stale, marked_stale_by_user", () => {
    const item = withType(makeItem({ confidence: 0.6 }), "confirmed_insight");
    const res = applySignalToItem({
      item,
      signal_id: "not_anymore",
      now: NOW,
      source_event_id: "evt_na",
      source_type: "memory_screen",
      context_surface: "memory_screen",
    });

    expect(res.item.status).toBe("stale");
    expect(res.item.user_feedback_state).toBe("marked_stale_by_user");
    expect(res.audit.action).toBe("mark_stale");
  });

  it("hide only changes visibility_scope", () => {
    const item = withType(makeItem({ confidence: 0.5 }), "confirmed_insight");
    const res = applySignalToItem({
      item,
      signal_id: "hide",
      now: NOW,
      source_event_id: "evt_hide",
      source_type: "memory_screen",
      context_surface: "memory_screen",
    });

    expect(res.item.confidence).toBeCloseTo(0.5);
    expect(res.item.status).toBe("active");
    expect(res.item.user_feedback_state).toBe("none");
    expect(res.item.visibility_scope).toBe("hidden");
    expect(res.audit.action).toBe("hide");
  });

  it("resonance signals (like) do NOT change confidence or status", () => {
    const item = withType(makeItem({ confidence: 0.4 }), "hypothesis");
    const res = applySignalToItem({
      item,
      signal_id: "like",
      now: NOW,
      source_event_id: "evt_like",
      source_type: "memory_screen",
      context_surface: "memory_screen",
    });

    expect(res.applied_delta).toBe(0);
    expect(res.item.confidence).toBeCloseTo(0.4);
    expect(res.item.status).toBe("active");
    expect(res.item.user_feedback_state).toBe("none");
    expect(res.item.sources.at(-1)?.signal_kind).toBe("resonance");
  });

  it("hypothesis → confirmed_insight on 2 explicit yes within 30d", () => {
    const earlier = new Date(NOW.getTime() - 10 * 24 * 3600 * 1000);
    const prior = [makeYesThatFits(earlier, { event_id: "yes_prior" })];
    const item = withType(makeItem({ confidence: 0.5 }), "hypothesis");

    const res = applySignalToItem({
      item,
      signal_id: "yes_that_fits",
      now: NOW,
      source_event_id: "yes_new",
      source_type: "memory_screen",
      context_surface: "memory_screen",
      prior_signals: prior,
    });

    expect(res.item.type).toBe("confirmed_insight");
    expect(res.transition).toBe("hypothesis_to_confirmed_insight");
  });

  it("state_history grows only on status change", () => {
    const item = withType(makeItem({ confidence: 0.5 }), "confirmed_insight");
    const baselineHistory = item.state_history.length;

    const noChange = applySignalToItem({
      item,
      signal_id: "like",
      now: NOW,
      source_event_id: "e1",
      source_type: "memory_screen",
      context_surface: "memory_screen",
    });
    expect(noChange.item.state_history.length).toBe(baselineHistory);

    const withChange = applySignalToItem({
      item,
      signal_id: "not_quite",
      now: NOW,
      source_event_id: "e2",
      source_type: "memory_screen",
      context_surface: "memory_screen",
    });
    expect(withChange.item.state_history.length).toBe(baselineHistory + 1);
    expect(withChange.item.state_history.at(-1)?.to_status).toBe("re_check");
  });
});

describe("itemUpsert.persistSignalToItem", () => {
  it("atomically writes item + audit (D.6)", async () => {
    const storage = new InMemoryStorageAdapter({ storage: null });
    const item = withType(
      makeItem({ id: "item_persist", confidence: 0.5 }),
      "hypothesis",
    );
    await storage.upsertMemoryItem(item, {
      event_id: "bootstrap_audit",
      memory_item_id: item.id,
      action: "correction",
      user_id: TEST_USER_ID,
      timestamp: NOW.toISOString(),
      previous_state: { confidence: 0.5, status: "active" },
      new_state: { confidence: 0.5, status: "active" },
      context_surface: "memory_screen",
      source_event_id: null,
    });

    const res = await persistSignalToItem(storage, {
      item,
      signal_id: "yes_that_fits",
      now: NOW,
      source_event_id: "evt_yes",
      source_type: "memory_screen",
      context_surface: "memory_screen",
    });

    const audits = await storage.getAuditTrail(item.id);
    expect(audits.map((a) => a.event_id)).toContain(res.audit.event_id);
    const items = await storage.getMemoryItems(TEST_USER_ID);
    const persisted = items.find((i) => i.id === item.id);
    expect(persisted?.confidence).toBeCloseTo(res.item.confidence);
  });
});
