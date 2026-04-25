import { describe, expect, it } from "vitest";
import {
  computeDailySnapshot,
  dateKey,
  needsSoftRevalidation,
} from "../snapshot";
import type { SessionSummaryV1Sync } from "../../types";

const NOW = new Date("2026-04-19T12:00:00Z");
const USER_ID = "user_test";

function summary(
  id: string,
  completed_at: Date,
  overrides: Partial<SessionSummaryV1Sync> = {},
): SessionSummaryV1Sync {
  return {
    session_id: id,
    session_type: "check_in",
    summary_version: "v1_sync",
    completed_at: completed_at.toISOString(),
    user_stated: [],
    emotional_tone: { mood: "ok", emotions: ["calm"], valence: "neutral" },
    themes_obvious: ["focus"],
    helped_or_not: "yes",
    flags_runtime: ["none"],
    requires_async_enrichment: false,
    ...overrides,
  };
}

function daysBefore(base: Date, days: number): Date {
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("snapshot.dateKey", () => {
  it("formats UTC yyyy-mm-dd", () => {
    expect(dateKey(new Date("2026-04-19T23:59:59Z"))).toBe("2026-04-19");
  });
});

describe("snapshot.computeDailySnapshot", () => {
  it("counts days_since_last_checkin from latest check-in", () => {
    const summaries = [
      summary("a", daysBefore(NOW, 4)),
      summary("b", daysBefore(NOW, 6)),
    ];
    const s = computeDailySnapshot({
      userId: USER_ID,
      now: NOW,
      recentSummaries: summaries,
      practicesStartedToday: 0,
      practicesCompletedToday: 0,
      ringsState: { express: 0, presence: 0, insight: 0 },
      streakStatus: "broken",
    });
    expect(s.days_since_last_checkin).toBe(4);
    expect(s.date).toBe("2026-04-19");
  });

  it("computes trending emotions / themes from last 7 days", () => {
    const summaries = [
      summary("a", daysBefore(NOW, 1), {
        emotional_tone: { mood: "good", emotions: ["calm", "focused"], valence: "positive" },
        themes_obvious: ["focus"],
      }),
      summary("b", daysBefore(NOW, 3), {
        emotional_tone: { mood: "ok", emotions: ["calm"], valence: "neutral" },
        themes_obvious: ["sleep"],
      }),
      summary("c", daysBefore(NOW, 10), {
        emotional_tone: { mood: "tired", emotions: ["tired"], valence: "negative" },
        themes_obvious: ["energy"],
      }),
    ];
    const s = computeDailySnapshot({
      userId: USER_ID,
      now: NOW,
      recentSummaries: summaries,
      practicesStartedToday: 0,
      practicesCompletedToday: 0,
      ringsState: { express: 0, presence: 0, insight: 0 },
      streakStatus: "active",
    });
    expect(s.trending_emotions).toContain("calm");
    expect(s.trending_emotions).not.toContain("tired");
    expect(s.trending_themes).toContain("focus");
    expect(s.trending_themes).not.toContain("energy");
  });

  it("reports activity_level from days_active_last_7", () => {
    const dense = Array.from({ length: 5 }).map((_, i) =>
      summary(`d${i}`, daysBefore(NOW, i)),
    );
    const s = computeDailySnapshot({
      userId: USER_ID,
      now: NOW,
      recentSummaries: dense,
      practicesStartedToday: 0,
      practicesCompletedToday: 0,
      ringsState: { express: 0, presence: 0, insight: 0 },
      streakStatus: "active",
    });
    expect(s.activity_level).toBe("high");
  });
});

describe("snapshot.needsSoftRevalidation — SSOT E.5.1", () => {
  it("fires when days_since_last_checkin >= 3", () => {
    const s = computeDailySnapshot({
      userId: USER_ID,
      now: NOW,
      recentSummaries: [summary("a", daysBefore(NOW, 3))],
      practicesStartedToday: 0,
      practicesCompletedToday: 0,
      ringsState: { express: 0, presence: 0, insight: 0 },
      streakStatus: "broken",
    });
    expect(needsSoftRevalidation(s)).toBe(true);
  });
  it("does not fire at 2 days", () => {
    const s = computeDailySnapshot({
      userId: USER_ID,
      now: NOW,
      recentSummaries: [summary("a", daysBefore(NOW, 2))],
      practicesStartedToday: 0,
      practicesCompletedToday: 0,
      ringsState: { express: 0, presence: 0, insight: 0 },
      streakStatus: "broken",
    });
    expect(needsSoftRevalidation(s)).toBe(false);
  });
});
