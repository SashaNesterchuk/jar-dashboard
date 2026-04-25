/**
 * EPIC 7 DoD — "онбординг → 3 check-ins → observation visible on
 * Memory screen".
 *
 * This is the canonical end-to-end happy path for the input simulators:
 *   1. `buildOnboardingItems` (SSOT C.1.9 / D.1.2) produces declared /
 *      preference / boundary / temporary_constraint items.
 *   2. Three check-ins around the same trigger feed the sync pipeline.
 *      `ensureObservationsFromCard` upgrades the matching theme
 *      through a single `observation` item (SSOT D.2.1).
 *   3. The resulting observation is active, memory_screen-visible, and
 *      eligible for the observation → hypothesis transition per
 *      SSOT D.2.2 (3 consistent observations in 14 days).
 *
 * Also covers the DoD claim that premium toggle changes Smart Summary
 * without a reload: running `generateSmartSummary` twice with flipped
 * `is_premium` returns two differently-shaped outputs.
 */

import { describe, expect, it } from "vitest";
import { InMemoryStorageAdapter } from "../adapters/portal/inMemoryStorage";
import { portalDevAIAdapter } from "../adapters/portal/portalDevAI";
import { systemClock } from "../adapters/portal/systemClock";
import {
  detectObservationToHypothesisPatterns,
  eligiblePatterns,
} from "../async/pattern";
import { generateSmartSummary } from "../generation/smartSummary";
import { buildOnboardingItems } from "../onboarding/build";
import { normalizeToSessionCard } from "../sync/normalize";
import { ensureObservationsFromCard } from "../sync/observations";
import { buildSessionSummaryV1Sync } from "../sync/summary";
import type { CheckIn } from "../jarTypes";
import type { MemoryItem } from "../types";

const USER_ID = "u_e7";
const CLIENT_META = {
  app_version: "e7-test",
  locale: "en",
  timezone_offset: "+00:00",
};

describe("EPIC 7 DoD — onboarding → 3 check-ins → observation", () => {
  it("creates onboarding items, then an observation reinforced by 3 check-ins", async () => {
    const storage = new InMemoryStorageAdapter({ storage: null });
    const now0 = new Date("2026-04-15T08:00:00Z");

    // 1 — Onboarding.
    const onboarding = buildOnboardingItems(
      {
        user_name: "Alex",
        primary_motivation: ["Understanding my patterns"],
        focus_areas: ["Understanding my patterns"],
        support_style: "Gentle and calming",
        pain_map: ["Stress"],
      },
      { user_id: USER_ID, now: now0 },
    );
    for (let i = 0; i < onboarding.items.length; i++) {
      await storage.upsertMemoryItem(
        onboarding.items[i],
        onboarding.audits[i],
      );
    }

    // 2 — Three check-ins on the same trigger ("evenings").
    const times = [
      new Date("2026-04-15T20:00:00Z"),
      new Date("2026-04-16T20:00:00Z"),
      new Date("2026-04-18T20:00:00Z"),
    ];

    for (const at of times) {
      const check: CheckIn = {
        mood: "bad",
        reflection: `Evenings feel heavy again today. (${at.toISOString()})`,
      };
      const card = normalizeToSessionCard({
        session_id: `s_${at.getTime()}`,
        user_id: USER_ID,
        started_at: new Date(at.getTime() - 60_000),
        completed_at: at,
        event_type: "mood",
        check_in: check,
        selected_triggers: [
          { tKey: "trigger.evenings", label: "evenings", categoryId: "t" },
        ],
        client_metadata: CLIENT_META,
      });
      await storage.saveSessionCard(card);
      const v1 = buildSessionSummaryV1Sync({ card });
      await storage.saveSessionSummary(v1);

      const existing = await storage.getMemoryItems(USER_ID);
      const obs = ensureObservationsFromCard({
        user_id: USER_ID,
        card,
        existing,
        now: at,
      });
      for (let i = 0; i < obs.items.length; i++) {
        await storage.upsertMemoryItem(obs.items[i], obs.audits[i]);
      }
    }

    // 3 — Observation visible + D.2.2-eligible.
    const items = await storage.getMemoryItems(USER_ID);
    const eveningObs = items.filter(
      (i) => i.type === "observation" && i.theme_tags.includes("theme:evenings"),
    );
    expect(eveningObs).toHaveLength(1);
    const obs = eveningObs[0] as MemoryItem;
    expect(obs.status).toBe("active");
    expect(obs.visibility_scope).toBe("memory_screen");
    expect(obs.sources.length).toBe(3);
    expect(obs.sources.every((source) => source.source_type === "trigger_tags")).toBe(
      true,
    );

    // Onboarding items still there.
    expect(
      items.some((i) => i.type === "immutable_fact"),
    ).toBe(true);
    expect(
      items.some((i) => i.type === "declared_preference"),
    ).toBe(true);
    expect(
      items.some((i) => i.type === "temporary_constraint"),
    ).toBe(true);

    // D.2.2 eligibility check — synthesise the three observations by
    // reading the sources list so the pattern evaluator matches the
    // same shape the async enricher would see on scheduled sweeps.
    const synthetic = obs.sources.map((s, idx) => ({
      ...obs,
      id: `${obs.id}#${idx}`,
      first_seen_at: s.timestamp,
      last_supported_at: s.timestamp,
    }));
    const patterns = eligiblePatterns(
      detectObservationToHypothesisPatterns({
        observations: synthetic,
        now: times[times.length - 1],
      }),
    );
    expect(patterns.length).toBeGreaterThanOrEqual(1);
    expect(patterns[0].theme_tag).toBe("theme:evenings");
  });

  it("premium toggle changes Smart Summary output without reload", async () => {
    const storage = new InMemoryStorageAdapter({ storage: null });
    const card = normalizeToSessionCard({
      session_id: "s_prem",
      user_id: USER_ID,
      started_at: new Date("2026-04-18T20:00:00Z"),
      completed_at: new Date("2026-04-18T20:01:00Z"),
      event_type: "mood",
      check_in: { mood: "ok", reflection: "Evenings feel heavy." },
      selected_triggers: [
        { tKey: "trigger.evenings", label: "evenings", categoryId: "t" },
      ],
      client_metadata: CLIENT_META,
    });
    const v1a = buildSessionSummaryV1Sync({ card });
    const v1b = {
      ...v1a,
      session_id: "s_prev",
      themes_obvious: ["evenings"],
    };

    const freeRun = await generateSmartSummary(
      { ai: portalDevAIAdapter, clock: systemClock },
      {
        session_card: card,
        memory_items: [],
        recent_summaries: [v1b],
        stable_profile: null,
        avoided_topics: [],
        is_premium: false,
      },
    );

    const premiumRun = await generateSmartSummary(
      { ai: portalDevAIAdapter, clock: systemClock },
      {
        session_card: card,
        memory_items: [],
        recent_summaries: [v1b],
        stable_profile: null,
        avoided_topics: [],
        is_premium: true,
      },
    );

    expect(freeRun.output.word_count).toBeGreaterThan(0);
    expect(premiumRun.output.word_count).toBeGreaterThan(freeRun.output.word_count);
    expect(premiumRun.output.insight).not.toBe(freeRun.output.insight);
    // Storage isn't touched by the orchestrator itself.
    void storage;
  });
});
