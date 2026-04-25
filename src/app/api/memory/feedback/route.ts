/**
 * POST /api/memory/feedback
 *
 * Thin transport for memory reaction controls (SSOT C.3.4 + D.5.1).
 * Applies `Yes that fits / Not quite / Not anymore / Hide` to a
 * `MemoryItem` and returns the updated item + paired audit entry.
 *
 * Body:
 *   { user_id: string, item_id: string, action: MemoryFeedbackAction,
 *     context_surface?: ContextSurface }
 *
 * Response: { item, audit, transition, applied_delta }
 */

import { NextResponse } from "next/server";
import {
  sharedClock as clock,
  sharedStorage as storage,
  sharedTelemetry as telemetry,
} from "../_shared/adapters";
import {
  persistFeedback,
  type MemoryFeedbackAction,
} from "@/lib/memory/feedback/apply";
import type { ContextSurface } from "@/lib/memory/types";
import { guardServerSmokeRoute } from "../_shared/localFirst";

interface ApiPayload {
  user_id: string;
  item_id: string;
  action: MemoryFeedbackAction;
  context_surface?: ContextSurface;
}

const VALID_ACTIONS: readonly MemoryFeedbackAction[] = [
  "yes_that_fits",
  "not_quite",
  "not_anymore",
  "hide",
];

export async function POST(request: Request) {
  try {
    const guard = guardServerSmokeRoute();
    if (guard) return guard;

    const body = (await request.json()) as ApiPayload;
    if (!body?.user_id || !body?.item_id || !body?.action) {
      return NextResponse.json(
        { error: "user_id, item_id, action are required" },
        { status: 400 },
      );
    }
    if (!VALID_ACTIONS.includes(body.action)) {
      return NextResponse.json(
        { error: `invalid action '${body.action}'` },
        { status: 400 },
      );
    }

    const items = await storage.getMemoryItems(body.user_id);
    const item = items.find((i) => i.id === body.item_id);
    if (!item) {
      return NextResponse.json(
        { error: `memory item ${body.item_id} not found` },
        { status: 404 },
      );
    }

    const result = await persistFeedback(
      { storage, telemetry },
      {
        item,
        action: body.action,
        now: clock.now(),
        context_surface: body.context_surface,
      },
    );

    return NextResponse.json({
      item: result.item,
      audit: result.audit,
      transition: result.transition,
      applied_delta: result.applied_delta,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg, stack: e instanceof Error ? e.stack : undefined },
      { status: 500 },
    );
  }
}
