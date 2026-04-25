/**
 * End-to-end feedback pipeline (SSOT D.2 / C.3.4 / D.6).
 *
 * Covers EPIC 6 DoD items:
 *   - 3 observations on one theme → pattern detected (observation →
 *     hypothesis threshold SSOT D.2.2).
 *   - 2× yes_that_fits on a hypothesis → confirmed_insight.
 *   - Every mutation produces a paired audit entry (D.6).
 *   - Rollback within 24h restores prior state.
 */

import { describe, expect, it } from "vitest";
import { InMemoryStorageAdapter } from "../adapters/portal/inMemoryStorage";
import { persistFeedback } from "../feedback/apply";
import { persistRollback } from "../feedback/correction";
import {
  applySignalToItem,
  persistSignalToItem,
} from "../async/itemUpsert";
import {
  detectObservationToHypothesisPatterns,
  eligiblePatterns,
} from "../async/pattern";
import { newUuid } from "../async/id";
import type { MemoryItem } from "../types";

const USER_ID = "u_epic6";
const NOW = new Date("2026-04-19T12:00:00Z");

function baseObservation(
  id: string,
  theme: string,
  daysAgo: number,
): MemoryItem {
  const ts = new Date(NOW.getTime() - daysAgo * 24 * 3600 * 1000);
  return {
    id,
    user_id: USER_ID,
    type: "observation",
    status: "active",
    statement_user_facing: null,
    statement_internal: `${theme}_observation`,
    content: {
      claim: `User mentioned ${theme}`,
      domain: "context",
      polarity: "neutral",
      intensity: 0.5,
    },
    internal_evidence_summary: null,
    confidence: 0.5,
    freshness_score: 1,
    active_confidence: 0.5,
    last_confidence_computed_at: ts.toISOString(),
    first_seen_at: ts.toISOString(),
    last_supported_at: ts.toISOString(),
    user_feedback_state: "none",
    sources: [
      {
        source_type: "check_in_text",
        source_event_id: `src_${id}`,
        session_id: null,
        timestamp: ts.toISOString(),
        weight: 0.5,
        signal_kind: "corroboration",
      },
    ],
    source_event_ids: [`src_${id}`],
    sensitivity_level: "personal",
    visibility_scope: "memory_screen",
    theme_tags: [theme],
    related_focus_areas: [],
    state_history: [
      {
        from_status: null,
        to_status: "active",
        trigger_event_id: "bootstrap",
        timestamp: ts.toISOString(),
        auto_or_manual: "auto",
      },
    ],
    supersedes_id: null,
    version: 0,
    created_at: ts.toISOString(),
    updated_at: ts.toISOString(),
  };
}

function baseHypothesis(id: string, theme: string): MemoryItem {
  return {
    ...baseObservation(id, theme, 0),
    type: "hypothesis",
    statement_internal: `${theme}_hypothesis`,
    confidence: 0.45,
    active_confidence: 0.45,
  };
}

describe("EPIC 6 DoD — feedback pipeline", () => {
  it("3 observations on one theme → pattern eligible (D.2.2)", () => {
    const observations = [
      baseObservation("o1", "sleep", 2),
      baseObservation("o2", "sleep", 6),
      baseObservation("o3", "sleep", 10),
    ];
    const results = eligiblePatterns(
      detectObservationToHypothesisPatterns({
        observations,
        now: NOW,
      }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].theme_tag).toBe("sleep");
    expect(results[0].observation_ids).toHaveLength(3);
  });

  it("2× yes_that_fits on hypothesis → confirmed_insight (D.2.2 path A)", async () => {
    const storage = new InMemoryStorageAdapter({ storage: null });
    let item = baseHypothesis("h1", "short_walk_helps");
    await storage.upsertMemoryItem(item, {
      event_id: "boot",
      memory_item_id: item.id,
      action: "correction",
      user_id: USER_ID,
      timestamp: NOW.toISOString(),
      previous_state: { confidence: 0.45, status: "active" },
      new_state: { confidence: 0.45, status: "active" },
      context_surface: "memory_screen",
      source_event_id: null,
    });

    const firstTime = new Date(NOW.getTime() - 7 * 24 * 3600 * 1000);
    const first = await persistFeedback(
      { storage },
      { item, action: "yes_that_fits", now: firstTime },
    );
    expect(first.item.type).toBe("hypothesis");
    item = first.item;

    const second = await persistFeedback(
      { storage },
      {
        item,
        action: "yes_that_fits",
        now: NOW,
        prior_signals: [
          {
            event_id: first.audit.source_event_id ?? "first",
            signal_id: "yes_that_fits",
            signal_kind: "truth_confirmation",
            timestamp: firstTime,
            memory_item_id: item.id,
          },
        ],
      },
    );
    expect(second.item.type).toBe("confirmed_insight");
    expect(second.transition).toBe("hypothesis_to_confirmed_insight");

    // Every update paired with audit (D.6).
    const trail = await storage.getAuditTrail(item.id);
    expect(trail.length).toBeGreaterThanOrEqual(3); // bootstrap + 2 confirmations
  });

  it("audit is paired for every signal applied (D.6 guardrail)", async () => {
    const storage = new InMemoryStorageAdapter({ storage: null });
    const item = baseHypothesis("h_audit", "focus");
    await storage.upsertMemoryItem(item, {
      event_id: "boot2",
      memory_item_id: item.id,
      action: "correction",
      user_id: USER_ID,
      timestamp: NOW.toISOString(),
      previous_state: { confidence: item.confidence, status: "active" },
      new_state: { confidence: item.confidence, status: "active" },
      context_surface: "memory_screen",
      source_event_id: null,
    });

    // Apply a sequence of signals and count audit events.
    const signals: Array<"yes_that_fits" | "not_quite" | "hide" | "like"> = [
      "yes_that_fits",
      "not_quite",
      "hide",
      "like",
    ];
    for (const signal of signals) {
      await persistSignalToItem(storage, {
        item,
        signal_id: signal,
        now: NOW,
        source_event_id: newUuid(),
        source_type: "memory_screen",
        context_surface: "memory_screen",
      });
    }
    const trail = await storage.getAuditTrail(item.id);
    // Bootstrap + 4 signal applications
    expect(trail.length).toBe(1 + signals.length);
  });

  it("rollback within 24h restores prior state (D.2.4)", async () => {
    const storage = new InMemoryStorageAdapter({ storage: null });
    const item = {
      ...baseHypothesis("h_rb", "sleep"),
      type: "confirmed_insight" as const,
      confidence: 0.7,
      active_confidence: 0.7,
    };
    await storage.upsertMemoryItem(item, {
      event_id: "boot3",
      memory_item_id: item.id,
      action: "correction",
      user_id: USER_ID,
      timestamp: NOW.toISOString(),
      previous_state: { confidence: 0.7, status: "active" },
      new_state: { confidence: 0.7, status: "active" },
      context_surface: "memory_screen",
      source_event_id: null,
    });

    const feedbackTime = new Date(NOW.getTime() - 3600 * 1000);
    const fb = applySignalToItem({
      item,
      signal_id: "not_anymore",
      now: feedbackTime,
      source_event_id: "fb_na",
      source_type: "memory_screen",
      context_surface: "memory_screen",
    });
    await storage.upsertMemoryItem(fb.item, fb.audit);
    expect(fb.item.status).toBe("stale");

    const rb = await persistRollback(
      { storage },
      { item: fb.item, audit: fb.audit, now: NOW },
    );
    expect(rb.allowed).toBe(true);
    expect(rb.item?.status).toBe("active");
    const items = await storage.getMemoryItems(USER_ID);
    const persisted = items.find((i) => i.id === item.id);
    expect(persisted?.status).toBe("active");
  });
});
