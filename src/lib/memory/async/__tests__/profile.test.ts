import { describe, expect, it } from "vitest";
import {
  recomputeAsyncSlices,
  recomputeOnDemandSlices,
  recomputeStableProfile,
  recomputeSyncSlices,
} from "../profile";
import type {
  ConfidenceScoreInputs,
  DailySnapshot,
  StableProfile,
} from "../../types";
import {
  daysBefore,
  makeItem,
  TEST_USER_ID,
  withType,
} from "../../__tests__/fixtures";

const NOW = new Date("2026-04-19T12:00:00Z");

const EMPTY_CONFIDENCE: ConfidenceScoreInputs = {
  total_sessions: 0,
  text_sessions_ratio: 0,
  confirmed_signals_count: 0,
  contradicted_signals_count: 0,
  days_active_in_last_14: 0,
  source_diversity: 0,
  avg_freshness: 0,
};

describe("profile.recomputeSyncSlices", () => {
  it("pulls basics from immutable_fact items", () => {
    const items = [
      withType(
        makeItem({
          id: "name",
          theme_tags: ["name"],
          content: {
            claim: "Sasha",
            domain: "identity",
            polarity: "neutral",
            intensity: 1,
          },
        }),
        "immutable_fact",
      ),
      withType(
        makeItem({
          id: "locale",
          theme_tags: ["locale"],
          content: {
            claim: "en-US",
            domain: "identity",
            polarity: "neutral",
            intensity: 1,
          },
        }),
        "immutable_fact",
      ),
    ];
    const out = recomputeSyncSlices(null, items);
    expect(out.basics.name).toBe("Sasha");
    expect(out.basics.locale).toBe("en-US");
  });

  it("aggregates focus_areas from declared_preference items", () => {
    const items = [
      withType(
        makeItem({
          id: "a",
          related_focus_areas: ["energy", "sleep"],
        }),
        "declared_preference",
      ),
      withType(
        makeItem({ id: "b", related_focus_areas: ["sleep"] }),
        "declared_preference",
      ),
    ];
    const out = recomputeSyncSlices(null, items);
    expect(out.declared.focus_areas.sort()).toEqual(["energy", "sleep"]);
  });

  it("derives pain_map from negative temporary_constraints", () => {
    const items = [
      withType(
        makeItem({
          id: "p",
          content: {
            claim: "financial worries",
            domain: "context",
            polarity: "negative",
            intensity: 0.8,
          },
        }),
        "temporary_constraint",
      ),
    ];
    const out = recomputeSyncSlices(null, items);
    expect(out.current_constraints.pain_map).toContain("financial worries");
    expect(
      out.current_constraints.current_life_context.map((x) => x.topic),
    ).toContain("financial worries");
  });
});

describe("profile.recomputeAsyncSlices", () => {
  it("computes score/level/activity from inputs", () => {
    const snapshot: DailySnapshot = {
      date: "2026-04-19",
      user_id: TEST_USER_ID,
      last_mood: null,
      trending_emotions: [],
      trending_themes: [],
      activity_level: "medium",
      days_since_last_checkin: 0,
      days_active_last_7: 3,
      days_active_last_14: 8,
      practices_started_today: 1,
      practices_completed_today: 1,
      rings_state: { express: 0.5, presence: 0.3, insight: 0.4 },
      streak_status: "active",
      refreshed_at: NOW.toISOString(),
    };
    const inputs: ConfidenceScoreInputs = {
      total_sessions: 12,
      text_sessions_ratio: 0.5,
      confirmed_signals_count: 3,
      contradicted_signals_count: 0,
      days_active_in_last_14: 8,
      source_diversity: 3,
      avg_freshness: 0.8,
    };
    const out = recomputeAsyncSlices(null, inputs, snapshot);
    expect(out.user_confidence_score).toBeGreaterThan(0);
    expect(["A", "B", "C", "D"]).toContain(out.confidence_level);
    expect(out.activity_snapshot.streak_status).toBe("active");
    expect(out.activity_snapshot.total_sessions).toBe(12);
  });
});

describe("profile.recomputeOnDemandSlices", () => {
  it("picks hypotheses/insights above their active_confidence gates", () => {
    const strongHypothesis = withType(
      makeItem({
        id: "h1",
        type: "hypothesis",
        confidence: 0.9,
        freshness_score: 1,
        active_confidence: 0, // cache ignored
        last_supported_at: NOW.toISOString(),
      }),
      "hypothesis",
    );
    const weakHypothesis = withType(
      makeItem({
        id: "h2",
        type: "hypothesis",
        confidence: 0.2,
        freshness_score: 1,
        active_confidence: 1, // cache ignored
        last_supported_at: daysBefore(NOW, 40).toISOString(),
      }),
      "hypothesis",
    );
    const insight = withType(
      makeItem({
        id: "i1",
        type: "confirmed_insight",
        confidence: 0.8,
        freshness_score: 1,
        active_confidence: 0,
        last_supported_at: NOW.toISOString(),
      }),
      "confirmed_insight",
    );
    const out = recomputeOnDemandSlices(
      [strongHypothesis, weakHypothesis, insight],
      NOW,
    );
    expect(out.active_hypotheses.map((h) => h.id)).toEqual(["h1"]);
    expect(out.confirmed_insights.map((h) => h.id)).toEqual(["i1"]);
  });
});

describe("profile.recomputeStableProfile — mode selection", () => {
  it("full mode rewrites every slice", () => {
    const existing: StableProfile = {
      user_id: TEST_USER_ID,
      basics: { name: "Old", locale: "xx", sign_up_date: null },
      declared: {
        primary_motivation: ["stale"],
        top_value: null,
        focus_areas: ["stale"],
        support_style: null,
        realistic_action_modes: [],
        daily_time_budget: null,
        support_timing_preference: null,
      },
      current_constraints: {
        pain_map: ["stale"],
        avoided_topics: [],
        current_life_context: [],
      },
      what_tends_to_help: [],
      active_hypotheses: [],
      confirmed_insights: [],
      confidence_level: "A",
      user_confidence_score: 0,
      last_refreshed_at: "1970-01-01T00:00:00Z",
      activity_snapshot: {
        total_sessions: 0,
        days_active_in_last_14: 0,
        text_sessions_ratio: 0,
        streak_status: "none",
      },
    };
    const items = [
      withType(
        makeItem({
          id: "name",
          theme_tags: ["name"],
          content: {
            claim: "Sasha",
            domain: "identity",
            polarity: "neutral",
            intensity: 1,
          },
        }),
        "immutable_fact",
      ),
    ];
    const out = recomputeStableProfile({
      existing,
      userId: TEST_USER_ID,
      items,
      dailySnapshot: null,
      confidenceInputs: EMPTY_CONFIDENCE,
      now: NOW,
      mode: "full",
    });
    expect(out.basics.name).toBe("Sasha");
    expect(out.last_refreshed_at).toBe(NOW.toISOString());
  });

  it("sync mode preserves async-tier fields on existing profile", () => {
    const existing: StableProfile = {
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
      what_tends_to_help: [
        { practice_type: "walking", effectiveness_score: 0.8, sample_size: 5 },
      ],
      active_hypotheses: [],
      confirmed_insights: [],
      confidence_level: "C",
      user_confidence_score: 0.55,
      last_refreshed_at: "1970-01-01T00:00:00Z",
      activity_snapshot: {
        total_sessions: 10,
        days_active_in_last_14: 7,
        text_sessions_ratio: 0.4,
        streak_status: "active",
      },
    };
    const out = recomputeStableProfile({
      existing,
      userId: TEST_USER_ID,
      items: [],
      dailySnapshot: null,
      confidenceInputs: EMPTY_CONFIDENCE,
      now: NOW,
      mode: "sync",
    });
    expect(out.confidence_level).toBe("C");
    expect(out.user_confidence_score).toBe(0.55);
    expect(out.what_tends_to_help).toHaveLength(1);
  });
});
