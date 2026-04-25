/**
 * End-to-end sync pipeline smoke tests (SSOT E.2).
 *
 * Exercises the full chain: `normalizeToSessionCard` →
 * `buildSessionSummaryV1Sync` → `retrieve` → `generateSmartSummary`
 * against the real `InMemoryStorageAdapter` and the deterministic
 * `portalDevAIAdapter`. Used to cover EPIC 5 DoD (#1, #2).
 */

import { describe, expect, it } from "vitest";
import { InMemoryStorageAdapter } from "../adapters/portal/inMemoryStorage";
import { FakeStorage } from "../adapters/portal/__tests__/fakeStorage";
import { portalDevAIAdapter } from "../adapters/portal/portalDevAI";
import { createPortalTelemetryAdapter } from "../adapters/portal/portalTelemetry";
import { fixedClock } from "../adapters/portal/systemClock";
import { generateSmartSummary } from "../generation/smartSummary";
import { retrieve } from "../retrieval/retrieve";
import { buildSessionSummaryV1Sync } from "../sync/summary";
import { normalizeToSessionCard } from "../sync/normalize";

const NOW = new Date("2026-04-19T12:00:00Z");

describe("sync pipeline — end-to-end (SSOT E.2)", () => {
  it("round-trip: input → SessionCard → v1_sync → Smart Summary referencing signals", async () => {
    const storage = new InMemoryStorageAdapter({ storage: new FakeStorage() });
    const clock = fixedClock(NOW);
    const telemetry = createPortalTelemetryAdapter();

    const card = normalizeToSessionCard({
      session_id: "sess_1",
      user_id: "u1",
      started_at: NOW,
      completed_at: NOW,
      event_type: "mood",
      check_in: {
        mood: "ok",
        reflection: "Meetings with work felt heavy.",
      },
      selected_emotions: [{ tKey: "e.tired", label: "tired" }],
      selected_triggers: [
        { tKey: "t.meetings", label: "meetings", categoryId: "c" },
      ],
      client_metadata: {
        app_version: "portal-test",
        locale: "en",
        timezone_offset: "+00:00",
      },
    });
    await storage.saveSessionCard(card);

    const v1 = buildSessionSummaryV1Sync({ card });
    await storage.saveSessionSummary(v1);
    expect(v1.themes_obvious).toContain("meetings");

    const retrieval = await retrieve({
      userId: "u1",
      surface: "smart_summary_post_checkin",
      intent: {
        theme_tags: card.selected_triggers.map((t) => t.label),
      },
      storage,
      clock,
      telemetry,
    });

    const run = await generateSmartSummary(
      { ai: portalDevAIAdapter, clock, telemetry },
      {
        session_card: card,
        memory_items: retrieval.selected.map((r) => r.item),
        recent_summaries: [v1],
        stable_profile: null,
        avoided_topics: [],
        is_premium: false,
      },
    );

    expect(run.reason).toBe("ok");
    const combined = `${run.output.advice} ${run.output.insight} ${run.output.affirmation}`;
    // SSOT E.7.3 #1 — must reference at least one of the user's signals.
    expect(combined.toLowerCase()).toMatch(/(meetings|tired)/);
  });
});
