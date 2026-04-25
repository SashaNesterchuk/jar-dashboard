/**
 * Thin transport for the memory sync pipeline.
 *
 * POST /api/memory/session
 *
 * Body (JSON):
 *   {
 *     session: NormalizeCheckInInput (dates as ISO strings),
 *     soft_signals?: SoftSignalHints,
 *     skip_smart_summary?: boolean
 *   }
 *
 * Response:
 *   { session_card, v1_summary, smart_summary }
 *
 * Uses the same pure pipeline as the React hooks but with a
 * server-side adapter bundle (in-memory storage scoped to the serverless
 * process). Spec §3.3: API routes exist so AI keys never ship to the
 * browser. This route is intentionally minimal — smoke-test only.
 */

import { NextResponse } from "next/server";
import {
  sharedAi as ai,
  sharedClock as clock,
  sharedStorage as storage,
  sharedTelemetry as telemetry,
} from "../_shared/adapters";
import {
  normalizeToSessionCard,
  type NormalizeCheckInInput,
} from "@/lib/memory/sync/normalize";
import { ensureObservationsFromCard } from "@/lib/memory/sync/observations";
import {
  buildSessionSummaryV1Sync,
  type SoftSignalHints,
} from "@/lib/memory/sync/summary";
import { generateSmartSummary } from "@/lib/memory/generation/smartSummary";
import { retrieve } from "@/lib/memory/retrieval/retrieve";
import type { RetrievalIntent } from "@/lib/memory/retrieval/relevance";
import { guardServerSmokeRoute } from "../_shared/localFirst";

interface ApiPayload {
  session: Omit<NormalizeCheckInInput, "started_at" | "completed_at"> & {
    started_at: string;
    completed_at: string;
  };
  soft_signals?: SoftSignalHints;
  skip_smart_summary?: boolean;
  is_premium?: boolean;
  intent?: RetrievalIntent;
}

export async function POST(request: Request) {
  try {
    const guard = guardServerSmokeRoute();
    if (guard) return guard;

    const body = (await request.json()) as ApiPayload;
    if (!body?.session?.user_id) {
      return NextResponse.json(
        { error: "session.user_id is required" },
        { status: 400 },
      );
    }

    const normalizedInput: NormalizeCheckInInput = {
      ...body.session,
      started_at: new Date(body.session.started_at),
      completed_at: new Date(body.session.completed_at),
    };

    const card = normalizeToSessionCard(normalizedInput);
    await storage.saveSessionCard(card);

    const v1 = buildSessionSummaryV1Sync({
      card,
      soft_signals: body.soft_signals,
    });
    await storage.saveSessionSummary(v1);

    if (
      card.session_type === "check_in" ||
      card.session_type === "quick_check_in"
    ) {
      const existing = await storage.getMemoryItems(card.user_id);
      const obsResult = ensureObservationsFromCard({
        user_id: card.user_id,
        card,
        existing,
        now: clock.now(),
      });
      for (let i = 0; i < obsResult.items.length; i++) {
        await storage.upsertMemoryItem(
          obsResult.items[i],
          obsResult.audits[i],
        );
      }
    }

    if (body.skip_smart_summary) {
      return NextResponse.json({
        session_card: card,
        v1_summary: v1,
        smart_summary: null,
      });
    }

    const intent: RetrievalIntent = body.intent ?? {
      theme_tags: card.selected_triggers.map((t) => t.label),
      session_mentioned_topics: card.selected_triggers.map((t) => t.label),
    };

    const [retrieval, profile, recent] = await Promise.all([
      retrieve({
        userId: card.user_id,
        surface: "smart_summary_post_checkin",
        intent,
        storage,
        clock,
        telemetry,
      }),
      storage.getStableProfile(card.user_id),
      storage.getRecentSessionSummaries(card.user_id, 3),
    ]);

    const run = await generateSmartSummary(
      { ai, clock, telemetry },
      {
        session_card: card,
        memory_items: retrieval.selected.map((r) => r.item),
        recent_summaries: recent,
        stable_profile: profile,
        avoided_topics:
          profile?.current_constraints.avoided_topics ?? [],
        is_premium: Boolean(body.is_premium),
      },
    );

    return NextResponse.json({
      session_card: card,
      v1_summary: v1,
      smart_summary: run,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg, stack: e instanceof Error ? e.stack : undefined },
      { status: 500 },
    );
  }
}
