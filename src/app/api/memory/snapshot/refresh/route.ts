/**
 * POST /api/memory/snapshot/refresh
 *
 * Recompute the `DailySnapshot` for today (SSOT E.5). The portal stub
 * derives the snapshot from recent session summaries in the shared
 * adapter bundle; downstream ring / practice counters default to the
 * previous snapshot's values (caller can override via body).
 *
 * Body:
 *   {
 *     user_id: string,
 *     rings_state?: { express, presence, insight },
 *     streak_status?: "active" | "broken" | "none",
 *     practices_started_today?: number,
 *     practices_completed_today?: number,
 *   }
 *
 * Response:
 *   { snapshot: DailySnapshot, needs_soft_revalidation: boolean }
 */

import { NextResponse } from "next/server";
import {
  sharedClock as clock,
  sharedStorage as storage,
} from "../../_shared/adapters";
import {
  computeDailySnapshot,
  dateKey,
  needsSoftRevalidation,
} from "@/lib/memory/async/snapshot";
import type { DailySnapshot, StreakStatus } from "@/lib/memory/types";

interface ApiPayload {
  user_id: string;
  rings_state?: DailySnapshot["rings_state"];
  streak_status?: StreakStatus;
  practices_started_today?: number;
  practices_completed_today?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ApiPayload;
    if (!body?.user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 },
      );
    }

    const now = clock.now();
    const [recent, previous] = await Promise.all([
      storage.getRecentSessionSummaries(body.user_id, 50),
      storage.getDailySnapshot(body.user_id, dateKey(now)),
    ]);

    const snapshot = computeDailySnapshot({
      userId: body.user_id,
      now,
      recentSummaries: recent,
      ringsState:
        body.rings_state ??
        previous?.rings_state ??
        { express: 0, presence: 0, insight: 0 },
      streakStatus:
        body.streak_status ?? previous?.streak_status ?? "none",
      practicesStartedToday:
        body.practices_started_today ??
        previous?.practices_started_today ??
        0,
      practicesCompletedToday:
        body.practices_completed_today ??
        previous?.practices_completed_today ??
        0,
      previous: previous ?? undefined,
    });

    await storage.upsertDailySnapshot(snapshot);

    return NextResponse.json({
      snapshot,
      needs_soft_revalidation: needsSoftRevalidation(snapshot),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg, stack: e instanceof Error ? e.stack : undefined },
      { status: 500 },
    );
  }
}
