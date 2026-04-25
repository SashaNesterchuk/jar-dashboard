/**
 * POST /api/memory/enrich
 *
 * Thin transport for the async enrichment pipeline (SSOT E.4 v2 / E.7
 * step 2). Runs after the sync pipeline and optionally materialises
 * candidate hypotheses as `hypothesis` memory items with paired audit.
 *
 * Body:
 *   {
 *     session_card: SessionCard,
 *     sync_summary: SessionSummaryV1Sync,
 *     recent_context?: SessionSummaryV1Sync[],
 *     materialize_hypotheses?: boolean  // default true
 *   }
 *
 * Response: { summary, reason, created_hypotheses }
 */

import { NextResponse } from "next/server";
import {
  sharedAi as ai,
  sharedClock as clock,
  sharedStorage as storage,
  sharedTelemetry as telemetry,
} from "../_shared/adapters";
import { enrichSession } from "@/lib/memory/async/enrich";
import { persistSignalToItem } from "@/lib/memory/async/itemUpsert";
import { newUuid } from "@/lib/memory/async/id";
import type {
  CandidateHypothesis,
  MemoryItem,
  SessionCard,
  SessionSummaryV1Sync,
} from "@/lib/memory/types";

interface ApiPayload {
  session_card: SessionCard;
  sync_summary: SessionSummaryV1Sync;
  recent_context?: SessionSummaryV1Sync[];
  materialize_hypotheses?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ApiPayload;
    if (!body?.session_card?.user_id || !body?.sync_summary?.session_id) {
      return NextResponse.json(
        { error: "session_card.user_id and sync_summary are required" },
        { status: 400 },
      );
    }

    const recent =
      body.recent_context ??
      (await storage.getRecentSessionSummaries(
        body.session_card.user_id,
        3,
      ));

    const result = await enrichSession(
      { ai, clock, telemetry },
      {
        session_card: body.session_card,
        sync_summary: body.sync_summary,
        recent_context: recent,
      },
    );

    await storage.saveSessionSummary(result.summary);

    const created: MemoryItem[] = [];
    if (result.reason === "ok" && body.materialize_hypotheses !== false) {
      for (const h of result.summary.candidate_hypotheses) {
        const item = await materializeHypothesis(h, body.session_card);
        if (item) created.push(item);
      }
    }

    return NextResponse.json({
      summary: result.summary,
      reason: result.reason,
      created_hypotheses: created,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg, stack: e instanceof Error ? e.stack : undefined },
      { status: 500 },
    );
  }
}

async function materializeHypothesis(
  h: CandidateHypothesis,
  card: SessionCard,
): Promise<MemoryItem | null> {
  if (h.strength < 0.25) return null;
  const now = clock.now();
  const seed: MemoryItem = {
    id: newUuid(),
    user_id: card.user_id,
    type: "hypothesis",
    status: "active",
    statement_user_facing: null,
    statement_internal: h.statement,
    content: {
      claim: h.statement,
      domain: "behavior",
      polarity: "neutral",
      intensity: h.strength,
    },
    internal_evidence_summary: null,
    confidence: 0,
    freshness_score: 1,
    active_confidence: 0,
    last_confidence_computed_at: now.toISOString(),
    first_seen_at: now.toISOString(),
    last_supported_at: now.toISOString(),
    user_feedback_state: "none",
    sources: [],
    source_event_ids: [],
    sensitivity_level: "personal",
    visibility_scope: "memory_screen",
    theme_tags: [h.theme],
    related_focus_areas: [],
    state_history: [
      {
        from_status: null,
        to_status: "active",
        trigger_event_id: card.session_id,
        timestamp: now.toISOString(),
        auto_or_manual: "auto",
      },
    ],
    supersedes_id: null,
    version: 0,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const { item } = await persistSignalToItem(storage, {
    item: seed,
    signal_id: "reflection_text",
    now,
    source_event_id: card.session_id,
    source_type: "reflection",
    session_id: card.session_id,
    context_surface: "memory_screen",
  });
  return item;
}
