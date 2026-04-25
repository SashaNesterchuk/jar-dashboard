import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryStorageAdapter } from "../inMemoryStorage";
import {
  makeItem,
  TEST_ITEM_ID,
  TEST_USER_ID,
} from "../../../__tests__/fixtures";
import type {
  DailySnapshot,
  MemoryAuditEvent,
  SafetyEvent,
  SessionCard,
  SessionSummaryV1Sync,
  SessionSummaryV2Enriched,
  StableProfile,
} from "../../../types";
import { FakeStorage } from "./fakeStorage";

function makeAudit(
  overrides: Partial<MemoryAuditEvent> = {},
): MemoryAuditEvent {
  const base: MemoryAuditEvent = {
    event_id: "aud_1",
    memory_item_id: TEST_ITEM_ID,
    action: "confirm",
    user_id: TEST_USER_ID,
    timestamp: "2026-04-19T00:00:00Z",
    previous_state: { confidence: 0.4, status: "active" },
    new_state: { confidence: 0.55, status: "active" },
    context_surface: "memory_screen",
    source_event_id: null,
  };
  return { ...base, ...overrides };
}

function makeSession(id = "sess_1"): SessionCard {
  return {
    session_id: id,
    user_id: TEST_USER_ID,
    session_type: "check_in",
    started_at: "2026-04-19T00:00:00Z",
    completed_at: "2026-04-19T00:02:00Z",
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
  };
}

function makeSummary(
  session_id: string,
  at: string,
): SessionSummaryV1Sync {
  return {
    session_id,
    session_type: "check_in",
    summary_version: "v1_sync",
    completed_at: at,
    user_stated: [],
    emotional_tone: { mood: "ok", emotions: [], valence: "neutral" },
    themes_obvious: [],
    helped_or_not: "unclear",
    flags_runtime: ["none"],
    requires_async_enrichment: false,
  };
}

function makeProfile(): StableProfile {
  return {
    user_id: TEST_USER_ID,
    basics: { name: null, locale: null, sign_up_date: null },
    declared: {
      primary_motivation: [],
      top_value: null,
      focus_areas: [],
      support_style: null,
      realistic_action_modes: [],
      daily_time_budget: null,
      support_timing_preference: null,
    },
    current_constraints: {
      pain_map: [],
      avoided_topics: [],
      current_life_context: [],
    },
    what_tends_to_help: [],
    active_hypotheses: [],
    confirmed_insights: [],
    confidence_level: "A",
    user_confidence_score: 0,
    last_refreshed_at: "2026-04-19T00:00:00Z",
    activity_snapshot: {
      total_sessions: 0,
      days_active_in_last_14: 0,
      text_sessions_ratio: 0,
      streak_status: "none",
    },
  };
}

function makeDaily(date: string): DailySnapshot {
  return {
    date,
    user_id: TEST_USER_ID,
    last_mood: null,
    trending_emotions: [],
    trending_themes: [],
    activity_level: "low",
    days_since_last_checkin: 0,
    days_active_last_7: 0,
    days_active_last_14: 0,
    practices_started_today: 0,
    practices_completed_today: 0,
    rings_state: { express: 0, presence: 0, insight: 0 },
    streak_status: "none",
    refreshed_at: "2026-04-19T00:00:00Z",
  };
}

describe("InMemoryStorageAdapter (Spec §3.1)", () => {
  let storage: FakeStorage;
  let adapter: InMemoryStorageAdapter;

  beforeEach(() => {
    storage = new FakeStorage();
    adapter = new InMemoryStorageAdapter({ storage });
  });

  describe("memory_items + audit (SSOT D.3, D.6)", () => {
    it("upsertMemoryItem stores item and audit atomically", async () => {
      const item = makeItem();
      const audit = makeAudit();
      const stored = await adapter.upsertMemoryItem(item, audit);

      expect(stored).toEqual(item);
      const items = await adapter.getMemoryItems(TEST_USER_ID);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(TEST_ITEM_ID);

      const trail = await adapter.getAuditTrail(TEST_ITEM_ID);
      expect(trail).toHaveLength(1);
      expect(trail[0].action).toBe("confirm");
    });

    it("upsert is idempotent on id (overwrites existing)", async () => {
      await adapter.upsertMemoryItem(makeItem(), makeAudit());
      await adapter.upsertMemoryItem(
        makeItem({ confidence: 0.9, version: 2 }),
        makeAudit({ event_id: "aud_2" }),
      );
      const items = await adapter.getMemoryItems(TEST_USER_ID);
      expect(items).toHaveLength(1);
      expect(items[0].confidence).toBe(0.9);
      expect(items[0].version).toBe(2);

      const trail = await adapter.getAuditTrail(TEST_ITEM_ID);
      expect(trail).toHaveLength(2);
    });

    it("appendAudit without item-state-change still records", async () => {
      await adapter.appendAudit(
        makeAudit({ event_id: "aud_x", action: "why_query" }),
      );
      const trail = await adapter.getAuditTrail(TEST_ITEM_ID);
      expect(trail.map((e) => e.action)).toEqual(["why_query"]);
    });

    it("returns deep clones — mutating output does not mutate store", async () => {
      await adapter.upsertMemoryItem(makeItem(), makeAudit());
      const items = await adapter.getMemoryItems(TEST_USER_ID);
      items[0].confidence = 0.01;
      const again = await adapter.getMemoryItems(TEST_USER_ID);
      expect(again[0].confidence).toBe(0.5);
    });
  });

  describe("filter (MemoryItemFilter)", () => {
    beforeEach(async () => {
      await adapter.upsertMemoryItem(
        makeItem({ id: "a", type: "observation", theme_tags: ["sleep"] }),
        makeAudit({ event_id: "aa", memory_item_id: "a" }),
      );
      await adapter.upsertMemoryItem(
        makeItem({ id: "b", type: "hypothesis", theme_tags: ["sleep"] }),
        makeAudit({ event_id: "bb", memory_item_id: "b" }),
      );
      await adapter.upsertMemoryItem(
        makeItem({
          id: "c",
          type: "confirmed_insight",
          status: "re_check",
          theme_tags: ["recovery"],
          related_focus_areas: ["energy"],
        }),
        makeAudit({ event_id: "cc", memory_item_id: "c" }),
      );
    });

    it("filters by types", async () => {
      const res = await adapter.getMemoryItems(TEST_USER_ID, {
        types: ["hypothesis", "confirmed_insight"],
      });
      expect(res.map((i) => i.id).sort()).toEqual(["b", "c"]);
    });

    it("filters by statuses", async () => {
      const res = await adapter.getMemoryItems(TEST_USER_ID, {
        statuses: ["re_check"],
      });
      expect(res.map((i) => i.id)).toEqual(["c"]);
    });

    it("filters by theme_tags intersection", async () => {
      const res = await adapter.getMemoryItems(TEST_USER_ID, {
        theme_tags: ["sleep"],
      });
      expect(res.map((i) => i.id).sort()).toEqual(["a", "b"]);
    });

    it("filters by focus_areas intersection", async () => {
      const res = await adapter.getMemoryItems(TEST_USER_ID, {
        focus_areas: ["energy"],
      });
      expect(res.map((i) => i.id)).toEqual(["c"]);
    });
  });

  describe("sessions + summaries (SSOT E.3/E.4)", () => {
    it("saves session cards keyed by session_id (upsert)", async () => {
      await adapter.saveSessionCard(makeSession("s1"));
      await adapter.saveSessionCard(
        { ...makeSession("s1"), user_stated_text: "hi" },
      );
      await adapter.saveSessionCard(makeSession("s2"));
      const snap = adapter.__getSnapshot();
      expect(snap.sessions).toHaveLength(2);
      expect(snap.sessions.find((s) => s.session_id === "s1")!.user_stated_text)
        .toBe("hi");
    });

    it("getRecentSessionSummaries returns most recent first, user-scoped", async () => {
      await adapter.saveSessionCard(makeSession("s1"));
      await adapter.saveSessionCard(makeSession("s2"));
      await adapter.saveSessionSummary(
        makeSummary("s1", "2026-04-19T00:00:00Z"),
      );
      await adapter.saveSessionSummary(
        makeSummary("s2", "2026-04-20T00:00:00Z"),
      );

      const recent = await adapter.getRecentSessionSummaries(TEST_USER_ID, 5);
      expect(recent.map((s) => s.session_id)).toEqual(["s2", "s1"]);
    });

    it("accepts both v1_sync and v2_enriched summaries", async () => {
      await adapter.saveSessionSummary(
        makeSummary("s1", "2026-04-19T00:00:00Z"),
      );
      const enriched: SessionSummaryV2Enriched = {
        session_id: "s1",
        summary_version: "v2_enriched",
        enriched_at: "2026-04-19T00:05:00Z",
        themes_deep: ["deep"],
        candidate_hypotheses: [],
        cross_session_signals: [],
        effectiveness_observation: null,
      };
      await adapter.saveSessionSummary(enriched);
      const snap = adapter.__getSnapshot();
      expect(snap.summaries_v1).toHaveLength(1);
      expect(snap.summaries_v2).toHaveLength(1);
    });
  });

  describe("stable_profile + daily_snapshot (SSOT D.8, E.5)", () => {
    it("upsert then get for stable profile", async () => {
      expect(await adapter.getStableProfile(TEST_USER_ID)).toBeNull();
      await adapter.upsertStableProfile(makeProfile());
      const fetched = await adapter.getStableProfile(TEST_USER_ID);
      expect(fetched?.user_id).toBe(TEST_USER_ID);
    });

    it("stores daily snapshots by (user, date)", async () => {
      await adapter.upsertDailySnapshot(makeDaily("2026-04-19"));
      await adapter.upsertDailySnapshot(makeDaily("2026-04-20"));
      expect(
        (await adapter.getDailySnapshot(TEST_USER_ID, "2026-04-19"))?.date,
      ).toBe("2026-04-19");
      expect(
        await adapter.getDailySnapshot(TEST_USER_ID, "2026-04-21"),
      ).toBeNull();
    });
  });

  describe("safety events (SSOT F.1)", () => {
    it("append persists events", async () => {
      const evt: SafetyEvent = {
        id: "sev_1",
        user_id: TEST_USER_ID,
        session_id: null,
        surface: "smart_summary",
        flag: "soft",
        reason: "tone_generic",
        suggested_action: "regenerate",
        classifier_latency_ms: 120,
        timestamp: "2026-04-19T00:00:00Z",
        output_hash: "h",
      };
      await adapter.appendSafetyEvent(evt);
      expect(adapter.__getSnapshot().safety_events).toHaveLength(1);
    });
  });

  describe("localStorage persistence", () => {
    it("survives reload through localStorage mirror (DoD)", async () => {
      const item = makeItem();
      await adapter.upsertMemoryItem(item, makeAudit());

      // Simulate reload: a new adapter instance reads the same storage.
      const revived = new InMemoryStorageAdapter({ storage });
      const items = await revived.getMemoryItems(TEST_USER_ID);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(TEST_ITEM_ID);

      const trail = await revived.getAuditTrail(TEST_ITEM_ID);
      expect(trail).toHaveLength(1);
    });

    it("works without storage (RAM-only)", async () => {
      const ramOnly = new InMemoryStorageAdapter({ storage: null });
      await ramOnly.upsertMemoryItem(makeItem(), makeAudit());
      const items = await ramOnly.getMemoryItems(TEST_USER_ID);
      expect(items).toHaveLength(1);
    });
  });
});
