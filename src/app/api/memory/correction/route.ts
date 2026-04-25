/**
 * POST /api/memory/correction
 *
 * Thin transport for the 24-hour rollback of a prior
 * `Not quite / Not anymore / Hide` on a memory item (SSOT D.2.4).
 *
 * Body:
 *   { user_id: string, item_id: string, audit_event_id?: string }
 *
 * When `audit_event_id` is omitted the server picks the most recent
 * revertible audit entry on the item.
 *
 * Response: { allowed, verdict, item?, audit? }
 */

import { NextResponse } from "next/server";
import {
  sharedClock as clock,
  sharedStorage as storage,
  sharedTelemetry as telemetry,
} from "../_shared/adapters";
import { persistRollback } from "@/lib/memory/feedback/correction";
import { ROLLBACK_WINDOW_HOURS } from "@/lib/memory/constants";
import type { MemoryAuditEvent } from "@/lib/memory/types";
import { guardServerSmokeRoute } from "../_shared/localFirst";

interface ApiPayload {
  user_id: string;
  item_id: string;
  audit_event_id?: string;
}

const REVERTIBLE_ACTIONS: ReadonlySet<MemoryAuditEvent["action"]> = new Set([
  "soft_reject",
  "mark_stale",
  "hide",
]);

export async function POST(request: Request) {
  try {
    const guard = guardServerSmokeRoute();
    if (guard) return guard;

    const body = (await request.json()) as ApiPayload;
    if (!body?.user_id || !body?.item_id) {
      return NextResponse.json(
        { error: "user_id and item_id are required" },
        { status: 400 },
      );
    }

    const [items, audit] = await Promise.all([
      storage.getMemoryItems(body.user_id),
      storage.getAuditTrail(body.item_id),
    ]);
    const item = items.find((i) => i.id === body.item_id);
    if (!item) {
      return NextResponse.json(
        { error: `memory item ${body.item_id} not found` },
        { status: 404 },
      );
    }

    let target: MemoryAuditEvent | null = null;
    if (body.audit_event_id) {
      target = audit.find((e) => e.event_id === body.audit_event_id) ?? null;
    } else {
      target =
        [...audit]
          .reverse()
          .find((e) => REVERTIBLE_ACTIONS.has(e.action)) ?? null;
    }

    if (!target) {
      return NextResponse.json({
        allowed: false,
        verdict: {
          allowed: false,
          reason: "no revertible action found",
          window_hours: ROLLBACK_WINDOW_HOURS,
        },
      });
    }

    const result = await persistRollback(
      { storage, telemetry },
      {
        item,
        audit: target,
        now: clock.now(),
      },
    );

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg, stack: e instanceof Error ? e.stack : undefined },
      { status: 500 },
    );
  }
}
