"use client";

/**
 * `useAsyncEnrichment(userId)` — runs the async enrichment pipeline
 * (SSOT E.4 v2, SSOT E.7 step 2) for a completed session:
 *
 *   1. Call `enrichSession()` via the AI adapter.
 *   2. Persist `SessionSummaryV2Enriched` via `StorageAdapter`.
 *   3. For every candidate hypothesis, upsert a `hypothesis` memory
 *      item with a paired audit entry (SSOT D.6).
 *
 * The hook is intentionally thin — the pure logic lives in
 * `async/enrich.ts` + `async/itemUpsert.ts`. UI calls `run({ ... })`
 * once the sync pipeline returns.
 */

import * as React from "react";
import {
  enrichSession,
  type EnrichSessionResult,
} from "../async/enrich";
import { persistSignalToItem } from "../async/itemUpsert";
import { newUuid } from "../async/id";
import type {
  CandidateHypothesis,
  MemoryItem,
  SessionCard,
  SessionSummaryV1Sync,
  SessionSummaryV2Enriched,
} from "../types";
import {
  useMemoryAI,
  useMemoryClock,
  useMemoryStorage,
  useMemoryTelemetry,
} from "./useMemoryContext";

export interface UseAsyncEnrichmentResult {
  run: (args: RunArgs) => Promise<EnrichRunResult>;
  isEnriching: boolean;
  error: Error | null;
  lastResult: EnrichRunResult | null;
}

export interface RunArgs {
  session_card: SessionCard;
  sync_summary: SessionSummaryV1Sync;
  /** Optional override for recent summaries; defaults to last 3 from storage. */
  recent_context?: readonly SessionSummaryV1Sync[];
}

export interface EnrichRunResult {
  summary: SessionSummaryV2Enriched;
  reason: EnrichSessionResult["reason"];
  created_hypotheses: MemoryItem[];
}

export function useAsyncEnrichment(
  userId: string | null | undefined,
): UseAsyncEnrichmentResult {
  const storage = useMemoryStorage();
  const ai = useMemoryAI();
  const clock = useMemoryClock();
  const telemetry = useMemoryTelemetry();

  const [isEnriching, setIsEnriching] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [lastResult, setLastResult] = React.useState<EnrichRunResult | null>(
    null,
  );

  const run = React.useCallback(
    async (args: RunArgs): Promise<EnrichRunResult> => {
      if (!userId) throw new Error("useAsyncEnrichment.run: missing userId");
      setIsEnriching(true);
      setError(null);
      try {
        const recent =
          args.recent_context ??
          (await storage.getRecentSessionSummaries(userId, 3));

        const enrich = await enrichSession(
          { ai, clock, telemetry },
          {
            session_card: args.session_card,
            sync_summary: args.sync_summary,
            recent_context: recent,
          },
        );

        await storage.saveSessionSummary(enrich.summary);

        const createdHypotheses: MemoryItem[] = [];
        if (enrich.reason === "ok") {
          for (const hypothesis of enrich.summary.candidate_hypotheses) {
            const created = await upsertHypothesis({
              storage,
              userId,
              hypothesis,
              sessionCard: args.session_card,
              now: clock.now(),
            });
            if (created) createdHypotheses.push(created);
          }
        }

        const result: EnrichRunResult = {
          summary: enrich.summary,
          reason: enrich.reason,
          created_hypotheses: createdHypotheses,
        };
        setLastResult(result);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsEnriching(false);
      }
    },
    [userId, storage, ai, clock, telemetry],
  );

  return { run, isEnriching, error, lastResult };
}

/* ---------------------------------------------------------------- helpers */

async function upsertHypothesis(params: {
  storage: ReturnType<typeof useMemoryStorage>;
  userId: string;
  hypothesis: CandidateHypothesis;
  sessionCard: SessionCard;
  now: Date;
}): Promise<MemoryItem | null> {
  // Strong enough to promote to hypothesis? D.5.4 guardrails.
  if (params.hypothesis.strength < 0.25) return null;

  const itemId = newUuid();
  const seed: MemoryItem = {
    id: itemId,
    user_id: params.userId,
    type: "hypothesis",
    status: "active",
    statement_user_facing: null,
    statement_internal: params.hypothesis.statement,
    content: {
      claim: params.hypothesis.statement,
      domain: "behavior",
      polarity: "neutral",
      intensity: params.hypothesis.strength,
    },
    internal_evidence_summary: null,
    confidence: 0,
    freshness_score: 1,
    active_confidence: 0,
    last_confidence_computed_at: params.now.toISOString(),
    first_seen_at: params.now.toISOString(),
    last_supported_at: params.now.toISOString(),
    user_feedback_state: "none",
    sources: [],
    source_event_ids: [],
    sensitivity_level: "personal",
    visibility_scope: "memory_screen",
    theme_tags: [params.hypothesis.theme],
    related_focus_areas: [],
    state_history: [
      {
        from_status: null,
        to_status: "active",
        trigger_event_id: params.sessionCard.session_id,
        timestamp: params.now.toISOString(),
        auto_or_manual: "auto",
      },
    ],
    supersedes_id: null,
    version: 0,
    created_at: params.now.toISOString(),
    updated_at: params.now.toISOString(),
  };

  // Seed via a `reflection_text` corroboration signal (+0.20 evidence_delta).
  // This gives the hypothesis an initial confidence grounded in D.5.1.
  const result = await persistSignalToItem(params.storage, {
    item: seed,
    signal_id: "reflection_text",
    now: params.now,
    source_event_id: params.sessionCard.session_id,
    source_type: "reflection",
    session_id: params.sessionCard.session_id,
    context_surface: "memory_screen",
  });

  // Nudge initial confidence up to hypothesis.strength when the seed
  // produced a lower value; we cap to 0.6 to respect evidence-based
  // calibration (hypothesis stays below insight threshold).
  if (result.item.confidence < params.hypothesis.strength) {
    const fallback: MemoryItem = {
      ...result.item,
      confidence: Math.min(params.hypothesis.strength, 0.6),
    };
    fallback.active_confidence = fallback.confidence * fallback.freshness_score;
    await params.storage.upsertMemoryItem(fallback, {
      ...result.audit,
      event_id: newUuid(),
      action: "correction",
      previous_state: {
        ...result.audit.new_state,
      },
      new_state: {
        ...result.audit.new_state,
        confidence: fallback.confidence,
      },
      timestamp: params.now.toISOString(),
    });
    return fallback;
  }

  return result.item;
}
