/**
 * POST /api/memory/decay/sweep
 *
 * Nightly decay sweep — SSOT D.4 + D.2.2. Recomputes freshness and
 * active_confidence for every memory item of a user, flips
 * `hypothesis → stale` when decay thresholds are crossed (SSOT D.2.2),
 * and appends a paired `memory_audit_log.correction` entry per change
 * (SSOT D.6).
 *
 * Body:
 *   { user_id: string }
 *
 * Response:
 *   {
 *     user_id, updated_count, transitions,
 *     dry_run?: boolean,    // always false here; present for symmetry
 *   }
 *
 * This stub is intentionally light: it uses the shared in-memory
 * adapter bundle (§0.2 — we don't create migrations). When the owner
 * wires Supabase the body shape stays identical.
 */

import { NextResponse } from "next/server";
import {
  sharedClock as clock,
  sharedStorage as storage,
  sharedTelemetry as telemetry,
} from "../../_shared/adapters";
import { sweepDecay } from "@/lib/memory/state/decaySweep";

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
    const existing = await storage.getMemoryItems(body.user_id);
    const result = sweepDecay({ items: existing, now });

    for (let i = 0; i < result.items.length; i++) {
      await storage.upsertMemoryItem(result.items[i], result.audits[i]);
    }

    for (const t of result.transitions) {
      telemetry.capture("memory.state_transition", {
        user_id: body.user_id,
        item_id: t.item_id,
        from_status: t.from_status,
        to_status: t.to_status,
        reason: t.reason,
        trigger: "decay_sweep",
        at: now.toISOString(),
      });
    }

    return NextResponse.json({
      user_id: body.user_id,
      updated_count: result.items.length,
      transitions: result.transitions,
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
