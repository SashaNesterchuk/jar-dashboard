/**
 * Daily snapshot compute + soft re-validation trigger — SSOT E.5 / E.5.1.
 *
 * Pure module. The caller supplies:
 *   - the user's recent session summaries (SSOT E.4 shape)
 *   - the latest mood / emotions / themes
 *   - ring-state & streak status inputs
 *   - `now`, the clock adapter time
 *
 * and receives back a fully-populated `DailySnapshot`, plus a
 * derivation of the soft re-validation trigger flag
 * (`days_since_last_checkin >= 3` per SSOT E.5.1).
 */

import { SNAPSHOT_SOFT_REVALIDATION_DAYS } from "../constants";
import type {
  ActivityLevel,
  DailySnapshot,
  Mood,
  SessionSummaryV1Sync,
  StreakStatus,
} from "../types";

export interface SnapshotComputeInputs {
  userId: string;
  now: Date;
  /**
   * Recent session summaries — the module treats any summary with
   * `session_type === "check_in" | "quick_check_in"` as a check-in
   * for `days_since_last_checkin` counting.
   */
  recentSummaries: readonly SessionSummaryV1Sync[];
  /** Number of practices started today (any session_type). */
  practicesStartedToday: number;
  /** Number of practices completed today (`completed_at` present today). */
  practicesCompletedToday: number;
  ringsState: DailySnapshot["rings_state"];
  streakStatus: StreakStatus;
  /** Current snapshot (if any) to preserve metadata between refreshes. */
  previous?: DailySnapshot | null;
}

/**
 * Format a `Date` as `yyyy-mm-dd` in UTC. Caller can pass `now` in
 * any tz; we canonicalise to UTC to keep the key deterministic across
 * devices until E.11 defines per-user timezone handling.
 */
export function dateKey(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function diffDaysFloor(from: Date, to: Date): number {
  const fromKey = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const toKey = Date.UTC(
    to.getUTCFullYear(),
    to.getUTCMonth(),
    to.getUTCDate(),
  );
  return Math.max(0, Math.floor((toKey - fromKey) / MS_PER_DAY));
}

function isCheckIn(summary: SessionSummaryV1Sync): boolean {
  return (
    summary.session_type === "check_in" ||
    summary.session_type === "quick_check_in"
  );
}

function topN<T extends string>(items: readonly T[], n: number): T[] {
  const counts = new Map<T, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([v]) => v);
}

function daysActiveIn(
  summaries: readonly SessionSummaryV1Sync[],
  now: Date,
  windowDays: number,
): number {
  const cutoff = new Date(now.getTime() - windowDays * MS_PER_DAY);
  const active = new Set<string>();
  for (const s of summaries) {
    const t = new Date(s.completed_at);
    if (t >= cutoff && t <= now) active.add(dateKey(t));
  }
  return active.size;
}

function computeActivityLevel(daysActiveLast7: number): ActivityLevel {
  if (daysActiveLast7 >= 5) return "high";
  if (daysActiveLast7 >= 2) return "medium";
  return "low";
}

/**
 * SSOT E.5 — daily snapshot computation.
 */
export function computeDailySnapshot(
  inputs: SnapshotComputeInputs,
): DailySnapshot {
  const { now, recentSummaries } = inputs;

  const checkIns = recentSummaries.filter(isCheckIn);
  const lastCheckIn = checkIns
    .map((s) => new Date(s.completed_at))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const daysSinceLastCheckin = lastCheckIn
    ? diffDaysFloor(lastCheckIn, now)
    : 9999;

  const last7Cutoff = new Date(now.getTime() - 7 * MS_PER_DAY);
  const in7 = recentSummaries.filter((s) => {
    const t = new Date(s.completed_at);
    return t >= last7Cutoff && t <= now;
  });

  const trendingEmotions = topN(
    in7.flatMap((s) => s.emotional_tone.emotions),
    3,
  );
  const trendingThemes = topN(in7.flatMap((s) => s.themes_obvious), 3);

  const lastMood = pickLastMood(checkIns);

  const daysActiveLast7 = daysActiveIn(recentSummaries, now, 7);
  const daysActiveLast14 = daysActiveIn(recentSummaries, now, 14);

  return {
    date: dateKey(now),
    user_id: inputs.userId,
    last_mood: lastMood,
    trending_emotions: trendingEmotions,
    trending_themes: trendingThemes,
    activity_level: computeActivityLevel(daysActiveLast7),
    days_since_last_checkin: daysSinceLastCheckin,
    days_active_last_7: daysActiveLast7,
    days_active_last_14: daysActiveLast14,
    practices_started_today: inputs.practicesStartedToday,
    practices_completed_today: inputs.practicesCompletedToday,
    rings_state: { ...inputs.ringsState },
    streak_status: inputs.streakStatus,
    refreshed_at: now.toISOString(),
  };
}

function pickLastMood(checkIns: readonly SessionSummaryV1Sync[]): Mood | null {
  const sorted = [...checkIns].sort(
    (a, b) =>
      new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
  );
  const top = sorted[0];
  return (top?.emotional_tone.mood ?? null) as Mood | null;
}

/**
 * SSOT E.5.1 — soft re-validation trigger.
 *
 * If the user has not checked in for three or more days, the next
 * Smart Summary should use a softer tone.
 */
export function needsSoftRevalidation(snapshot: DailySnapshot): boolean {
  return snapshot.days_since_last_checkin >= SNAPSHOT_SOFT_REVALIDATION_DAYS;
}
