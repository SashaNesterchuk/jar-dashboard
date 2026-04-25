"use client";

/**
 * `useSessionSubmit(userId)` — end-to-end sync pipeline (SSOT E.2):
 *
 *   normalize → save SessionCard → build v1_sync summary → save →
 *   generate Smart Summary (via `useSmartSummary`) → return output.
 *
 * Wraps the three pure modules (`sync/normalize`, `sync/summary`,
 * `generation/smartSummary`) and the storage adapter. The hook is
 * intentionally thin: UI calls `submit(input)`, receives
 * `SmartSummaryRunResult`, and can render the `output`.
 */

import * as React from "react";
import {
  normalizeToSessionCard,
  type NormalizeCheckInInput,
} from "../sync/normalize";
import { ensureObservationsFromCard } from "../sync/observations";
import {
  buildSessionSummaryV1Sync,
  type SoftSignalHints,
} from "../sync/summary";
import type {
  SessionCard,
  SessionSummaryV1Sync,
  StableProfile,
  StableProfileActivitySnapshot,
} from "../types";
import {
  useMemoryClock,
  useMemoryStorage,
  useMemoryTelemetry,
} from "./useMemoryContext";
import { useSmartSummary, type GenerateArgs } from "./useSmartSummary";
import type { SmartSummaryRunResult } from "../generation/smartSummary";

export interface UseSessionSubmitResult {
  submit: (input: SessionSubmitInput) => Promise<SessionSubmitResult>;
  isSubmitting: boolean;
  error: Error | null;
}

export interface SessionSubmitInput extends NormalizeCheckInInput {
  soft_signals?: SoftSignalHints;
  /** Skip Smart Summary when the surface does not need one (e.g. quick check-in). */
  skip_smart_summary?: boolean;
  /** Override retrieval intent; otherwise derived from triggers. */
  intent?: GenerateArgs["intent"];
}

export interface SessionSubmitResult {
  session_card: SessionCard;
  v1_summary: SessionSummaryV1Sync;
  smart_summary: SmartSummaryRunResult | null;
}

export function useSessionSubmit(
  userId: string | null | undefined,
): UseSessionSubmitResult {
  const storage = useMemoryStorage();
  const clock = useMemoryClock();
  const telemetry = useMemoryTelemetry();
  const { generate } = useSmartSummary(userId);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const submit = React.useCallback(
    async (input: SessionSubmitInput): Promise<SessionSubmitResult> => {
      if (!userId) throw new Error("useSessionSubmit.submit: missing userId");
      setIsSubmitting(true);
      setError(null);
      try {
        if (input.user_id !== userId) {
          throw new Error(
            "useSessionSubmit: session user_id does not match hook userId",
          );
        }
        // 1. Normalize (pure).
        const card = normalizeToSessionCard(input);

        // 2. Persist session_card + telemetry.
        await storage.saveSessionCard(card);
        telemetry.capture("session_completed", {
          user_id: userId,
          session_id: card.session_id,
          session_type: card.session_type,
        });

        // 3. Build + save v1_sync summary.
        const v1 = buildSessionSummaryV1Sync({
          card,
          soft_signals: input.soft_signals,
        });
        await storage.saveSessionSummary(v1);
        await refreshProfileActivitySnapshot({
          userId,
          storage,
          now: clock.now(),
        });

        // 3b. Session signal → observation (SSOT D.2.1). Runs only for
        // check-ins so practice / journal sessions don't seed fresh
        // observations that duplicate the reflection hook's work.
        if (
          card.session_type === "check_in" ||
          card.session_type === "quick_check_in"
        ) {
          const existing = await storage.getMemoryItems(userId);
          const obsResult = ensureObservationsFromCard({
            user_id: userId,
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

        // 4. Smart Summary generation (unless the caller opted out).
        let smart: SmartSummaryRunResult | null = null;
        if (!input.skip_smart_summary) {
          smart = await generate({
            session_card: card,
            intent: input.intent,
          });
        }

        return { session_card: card, v1_summary: v1, smart_summary: smart };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, storage, clock, telemetry, generate],
  );

  return { submit, isSubmitting, error };
}

async function refreshProfileActivitySnapshot(args: {
  userId: string;
  storage: ReturnType<typeof useMemoryStorage>;
  now: Date;
}): Promise<void> {
  const existing = await args.storage.getStableProfile(args.userId);
  if (!existing) return;

  const summaries = await args.storage.getRecentSessionSummaries(
    args.userId,
    Number.MAX_SAFE_INTEGER,
  );
  const activity = buildActivitySnapshot(summaries, args.now);

  const next: StableProfile = {
    ...existing,
    activity_snapshot: activity,
    last_refreshed_at: args.now.toISOString(),
  };
  await args.storage.upsertStableProfile(next);
}

function buildActivitySnapshot(
  summaries: readonly SessionSummaryV1Sync[],
  now: Date,
): StableProfileActivitySnapshot {
  const total = summaries.length;
  const textSessions = summaries.filter((summary) => {
    return summary.user_stated.some((text) => text.trim().length > 0);
  }).length;
  const daysActive = daysActiveInLast14(summaries, now);

  return {
    total_sessions: total,
    days_active_in_last_14: daysActive,
    text_sessions_ratio: total > 0 ? textSessions / total : 0,
    streak_status: daysActive > 0 ? "active" : "none",
  };
}

function daysActiveInLast14(
  summaries: readonly SessionSummaryV1Sync[],
  now: Date,
): number {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 13);
  start.setUTCHours(0, 0, 0, 0);

  const days = new Set<string>();
  for (const summary of summaries) {
    const completed = new Date(summary.completed_at);
    if (Number.isNaN(completed.getTime())) continue;
    if (completed < start || completed > now) continue;
    days.add(completed.toISOString().slice(0, 10));
  }
  return days.size;
}
