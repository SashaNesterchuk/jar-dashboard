import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryStorageAdapter } from "../../adapters/portal/inMemoryStorage";
import { fixedClock } from "../../adapters/portal/systemClock";
import type {
  MemoryAuditEvent,
  SessionSummaryV1Sync,
} from "../../types";
import {
  daysBefore,
  makeItem,
  makeSource,
  withSource,
  withType,
  TEST_USER_ID,
} from "../../__tests__/fixtures";
import { retrieve } from "../retrieve";
import { FakeStorage } from "../../adapters/portal/__tests__/fakeStorage";

const NOW = new Date("2026-04-19T12:00:00Z");

function adapter() {
  return new InMemoryStorageAdapter({ storage: new FakeStorage() });
}

function bootstrapAudit(itemId: string): MemoryAuditEvent {
  return {
    event_id: `aud_${itemId}`,
    memory_item_id: itemId,
    action: "confirm",
    user_id: TEST_USER_ID,
    timestamp: NOW.toISOString(),
    previous_state: { confidence: 0, status: "active" },
    new_state: { confidence: 0.8, status: "active" },
    context_surface: "memory_screen",
    source_event_id: null,
  };
}

async function seed(
  storage: InMemoryStorageAdapter,
  items: ReturnType<typeof makeItem>[],
) {
  for (const it of items) {
    await storage.upsertMemoryItem(it, bootstrapAudit(it.id));
  }
}

describe("retrieve — per-surface gates", () => {
  let storage: InMemoryStorageAdapter;
  beforeEach(() => {
    storage = adapter();
  });

  it("memory_screen returns active + re_check, excludes stale", async () => {
    await seed(storage, [
      makeItem({ id: "a", status: "active", theme_tags: ["x"] }),
      makeItem({ id: "b", status: "stale", theme_tags: ["x"] }),
      makeItem({ id: "c", status: "re_check", theme_tags: ["x"] }),
    ]);
    const out = await retrieve({
      userId: TEST_USER_ID,
      surface: "memory_screen",
      intent: { theme_tags: ["x"] },
      storage,
      clock: fixedClock(NOW),
    });
    const ids = out.selected.map((s) => s.item.id).sort();
    expect(ids).toEqual(["a", "c"]);
  });

  it("smart_summary drops active_confidence < 0.5", async () => {
    await seed(storage, [
      withType(
        makeItem({
          id: "hi",
          confidence: 0.9,
          freshness_score: 1,
          active_confidence: 0.9,
          last_supported_at: NOW.toISOString(),
          theme_tags: ["x"],
          type: "hypothesis",
        }),
        "hypothesis",
      ),
      withType(
        makeItem({
          id: "lo",
          confidence: 0.3,
          freshness_score: 1,
          active_confidence: 0.3,
          last_supported_at: NOW.toISOString(),
          theme_tags: ["x"],
          type: "hypothesis",
        }),
        "hypothesis",
      ),
    ]);
    const out = await retrieve({
      userId: TEST_USER_ID,
      surface: "smart_summary_post_checkin",
      intent: { theme_tags: ["x"] },
      storage,
      clock: fixedClock(NOW),
    });
    const ids = out.selected.map((s) => s.item.id);
    expect(ids).toContain("hi");
    expect(ids).not.toContain("lo");
  });

  it("sensitive items are excluded by default, but included if mentioned in session", async () => {
    const sensitive = makeItem({
      id: "s",
      sensitivity_level: "sensitive",
      confidence: 0.9,
      freshness_score: 1,
      active_confidence: 0.9,
      last_supported_at: NOW.toISOString(),
      theme_tags: ["finances"],
    });
    await seed(storage, [sensitive]);

    const withoutMention = await retrieve({
      userId: TEST_USER_ID,
      surface: "chat_reply",
      intent: { theme_tags: ["finances"] },
      storage,
      clock: fixedClock(NOW),
    });
    expect(withoutMention.selected).toHaveLength(0);

    const withMention = await retrieve({
      userId: TEST_USER_ID,
      surface: "chat_reply",
      intent: {
        theme_tags: ["finances"],
        session_mentioned_topics: ["finances"],
      },
      storage,
      clock: fixedClock(NOW),
    });
    expect(withMention.selected.map((s) => s.item.id)).toEqual(["s"]);
  });

  it("weekly_summary never admits sensitive items even if mentioned", async () => {
    const sensitive = makeItem({
      id: "s",
      sensitivity_level: "sensitive",
      confidence: 0.9,
      active_confidence: 0.9,
      freshness_score: 1,
      last_supported_at: NOW.toISOString(),
      theme_tags: ["finances"],
    });
    await seed(storage, [sensitive]);
    const out = await retrieve({
      userId: TEST_USER_ID,
      surface: "weekly_summary",
      intent: {
        theme_tags: ["finances"],
        session_mentioned_topics: ["finances"],
      },
      storage,
      clock: fixedClock(NOW),
    });
    expect(out.selected).toHaveLength(0);
  });
});

describe("retrieve — SSOT D.4.3 freshness guardrail", () => {
  it("result changes when now() advances, without updating the cache", async () => {
    const storage = adapter();
    const item = withType(
      makeItem({
        id: "it",
        type: "hypothesis",
        confidence: 1,
        freshness_score: 1,
        active_confidence: 1, // cached; should be IGNORED by retrieve
        last_supported_at: daysBefore(NOW, 0).toISOString(),
        theme_tags: ["x"],
      }),
      "hypothesis",
    );
    await seed(storage, [item]);

    const fresh = await retrieve({
      userId: TEST_USER_ID,
      surface: "chat_reply",
      intent: { theme_tags: ["x"] },
      storage,
      clock: fixedClock(NOW),
    });
    expect(fresh.selected[0]?.score.active_confidence).toBeCloseTo(1, 3);

    // 40 days later — hypothesis half-life is 10 days, so ≈ 2^-4 ≈ 0.0625.
    const later = new Date(NOW.getTime() + 40 * 24 * 60 * 60 * 1000);
    const aged = await retrieve({
      userId: TEST_USER_ID,
      surface: "chat_reply",
      intent: { theme_tags: ["x"] },
      storage,
      clock: fixedClock(later),
    });
    // active_confidence below 0.3 → item excluded from chat_reply.
    expect(aged.selected).toHaveLength(0);

    // Storage cache untouched — direct read still reports 1.
    const stored = await storage.getMemoryItems(TEST_USER_ID);
    expect(stored[0].active_confidence).toBe(1);
  });
});

describe("retrieve — contradictions + low-confidence fallback", () => {
  it("drops conflict loser (declared preference beats behaviour)", async () => {
    const storage = adapter();
    const declared = withType(
      withSource(
        makeItem({
          id: "pref",
          theme_tags: ["alcohol"],
          confidence: 0.9,
          freshness_score: 1,
          active_confidence: 0.9,
          last_supported_at: NOW.toISOString(),
          content: {
            claim: "prefers no alcohol",
            domain: "preference",
            polarity: "negative",
            intensity: 0.9,
          },
        }),
        makeSource({ source_type: "onboarding", weight: 1 }),
      ),
      "declared_preference",
    );
    const behaviour = withType(
      withSource(
        makeItem({
          id: "obs",
          theme_tags: ["alcohol"],
          confidence: 0.6,
          freshness_score: 1,
          active_confidence: 0.6,
          last_supported_at: NOW.toISOString(),
          content: {
            claim: "sometimes drinks on weekends",
            domain: "behavior",
            polarity: "positive",
            intensity: 0.6,
          },
        }),
        makeSource({ source_type: "pattern_detection", weight: 0.5 }),
      ),
      "observation",
    );
    await seed(storage, [declared, behaviour]);

    const out = await retrieve({
      userId: TEST_USER_ID,
      surface: "chat_reply",
      intent: { theme_tags: ["alcohol"] },
      storage,
      clock: fixedClock(NOW),
    });

    const ids = out.selected.map((s) => s.item.id);
    expect(ids).toContain("pref");
    expect(ids).not.toContain("obs");
  });

  it("emits memory.retrieval_contradiction for mutual unresolved hypotheses", async () => {
    const storage = adapter();
    const a = withType(
      makeItem({
        id: "ha",
        type: "hypothesis",
        theme_tags: ["focus"],
        confidence: 0.8,
        freshness_score: 1,
        active_confidence: 0.8,
        last_supported_at: NOW.toISOString(),
        content: {
          claim: "user focuses best in the morning",
          domain: "behavior",
          polarity: "positive",
          intensity: 0.7,
        },
      }),
      "hypothesis",
    );
    const b = withType(
      makeItem({
        id: "hb",
        type: "hypothesis",
        theme_tags: ["focus"],
        confidence: 0.8,
        freshness_score: 1,
        active_confidence: 0.8,
        last_supported_at: NOW.toISOString(),
        content: {
          claim: "user focuses best in the evening",
          domain: "behavior",
          polarity: "negative",
          intensity: 0.7,
        },
      }),
      "hypothesis",
    );
    await seed(storage, [a, b]);
    const capture = vi.fn();
    const out = await retrieve({
      userId: TEST_USER_ID,
      surface: "chat_reply",
      intent: { theme_tags: ["focus"] },
      storage,
      clock: fixedClock(NOW),
      telemetry: { capture },
    });
    expect(out.contradictions.length).toBeGreaterThan(0);
    expect(capture).toHaveBeenCalledWith(
      "memory.retrieval_contradiction",
      expect.objectContaining({ surface: "chat_reply" }),
    );
  });

  it("flags low_confidence_fallback when sum(active_confidence) < 1.5", async () => {
    const storage = adapter();
    const weak = withType(
      makeItem({
        id: "w",
        type: "hypothesis",
        confidence: 0.6,
        freshness_score: 1,
        active_confidence: 0.6,
        last_supported_at: NOW.toISOString(),
        theme_tags: ["x"],
      }),
      "hypothesis",
    );
    await seed(storage, [weak]);
    const out = await retrieve({
      userId: TEST_USER_ID,
      surface: "chat_reply",
      intent: { theme_tags: ["x"] },
      storage,
      clock: fixedClock(NOW),
    });
    expect(out.low_confidence_fallback).toBe(true);
  });

  it("returns summaries according to surface budget", async () => {
    const storage = adapter();
    const summaries: SessionSummaryV1Sync[] = Array.from({ length: 6 }).map(
      (_, i) => ({
        session_id: `s${i}`,
        session_type: "check_in",
        summary_version: "v1_sync",
        completed_at: daysBefore(NOW, i).toISOString(),
        user_stated: [],
        emotional_tone: { mood: "ok", emotions: [], valence: "neutral" },
        themes_obvious: [],
        helped_or_not: "yes",
        flags_runtime: ["none"],
        requires_async_enrichment: false,
      }),
    );
    for (const s of summaries) {
      await storage.saveSessionCard({
        session_id: s.session_id,
        user_id: TEST_USER_ID,
        session_type: "check_in",
        started_at: s.completed_at,
        completed_at: s.completed_at,
        entry_mood: null,
        exit_mood: null,
        user_stated_text: null,
        selected_emotions: [],
        selected_triggers: [],
        completion_state: "completed",
        reaction_to_output: {
          liked: false,
          disliked: false,
          echo_saved: false,
          regenerated: false,
        },
        practice_specific: {
          practice_id: null,
          effectiveness_self_report: null,
          duration_seconds: null,
        },
        flags_initial: ["none"],
        client_metadata: {
          app_version: "0.0.1",
          locale: "en",
          timezone_offset: "+00:00",
        },
      });
      await storage.saveSessionSummary(s);
    }

    const out = await retrieve({
      userId: TEST_USER_ID,
      surface: "chat_reply",
      intent: { theme_tags: [] },
      storage,
      clock: fixedClock(NOW),
    });
    // chat_reply budget.summaries = 5
    expect(out.summaries).toHaveLength(5);
  });
});
