/**
 * POST /api/memory/recalibrate
 *
 * Post-pause recalibration evaluator — SSOT D.7. For the given user,
 * checks `days_since_last_checkin` against the 7-day threshold and
 * reports back whether the banner / confidence factor should be
 * applied.
 *
 * This endpoint is evaluation-only. It does NOT mutate items — the
 * factor is applied at retrieval time via `applyRecalibration`
 * (SSOT D.7) so there is a single source of truth per session. The
 * portal memory debug surface uses the response to show the banner +
 * per-type factor breakdown.
 *
 * Body:
 *   { user_id: string }
 *
 * Response:
 *   {
 *     user_id,
 *     days_since_last_checkin,
 *     under_recalibration: boolean,
 *     factors: Record<MemoryItemType, number>,
 *     copy: { banner, returnPrompt },
 *   }
 */

import { NextResponse } from "next/server";
import {
  sharedClock as clock,
  sharedStorage as storage,
} from "../_shared/adapters";
import { RECALIBRATION_FACTOR } from "@/lib/memory/constants";
import {
  RECALIBRATION_COPY,
  isPauseExceeded,
} from "@/lib/memory/state/recalibration";
import { daysBetween } from "@/lib/memory/state/decay";

interface ApiPayload {
  user_id: string;
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
    const recent = await storage.getRecentSessionSummaries(body.user_id, 1);

    if (recent.length === 0) {
      return NextResponse.json({
        user_id: body.user_id,
        days_since_last_checkin: null,
        under_recalibration: false,
        factors: RECALIBRATION_FACTOR,
        copy: RECALIBRATION_COPY,
        ran_at: now.toISOString(),
      });
    }

    const days = daysBetween(new Date(recent[0].completed_at), now);
    return NextResponse.json({
      user_id: body.user_id,
      days_since_last_checkin: days,
      under_recalibration: isPauseExceeded(days),
      factors: RECALIBRATION_FACTOR,
      copy: RECALIBRATION_COPY,
      ran_at: now.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg, stack: e instanceof Error ? e.stack : undefined },
      { status: 500 },
    );
  }
}
