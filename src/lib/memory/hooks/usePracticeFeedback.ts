"use client";

/**
 * `usePracticeFeedback(userId)` — applies SSOT D.5.1 `practice_better`
 * / `practice_worse` signals after a practice session.
 *
 * SSOT E.4.1 decides the source of truth for `helped_or_not`: explicit
 * post-practice Better/Worse overrides soft signals. This hook only
 * wires the explicit case — soft-signal aggregation lives in
 * `sync/summary.ts`.
 *
 * Input is a list of candidate `MemoryItem` ids to update (the caller
 * chooses which items the practice outcome should corroborate or
 * contradict — typically matching theme). When no ids are passed the
 * hook is a no-op and returns an empty result, so simulator UIs can
 * render both "targeted" and "untargeted" flows without branching.
 */

import * as React from "react";
import {
  persistSignalToItem,
  type ApplySignalResult,
} from "../async/itemUpsert";
import type { ContextSurface, MemoryItem, SourceType } from "../types";
import {
  useMemoryClock,
  useMemoryStorage,
  useMemoryTelemetry,
} from "./useMemoryContext";

export type PracticeOutcome = "better" | "same" | "worse";

export interface ApplyPracticeFeedbackParams {
  item_ids: readonly string[];
  outcome: PracticeOutcome;
  /** The practice's session_id (used on sources[] and audit). */
  session_id: string;
  /** Practice type (`breathing`, `meditation`, `personal_practice` …). */
  practice_type: string;
  surface?: ContextSurface;
  source_type?: SourceType;
}

export interface UsePracticeFeedbackResult {
  apply: (
    params: ApplyPracticeFeedbackParams,
  ) => Promise<ApplyPracticeFeedbackResult>;
  isApplying: boolean;
  error: Error | null;
}

export interface ApplyPracticeFeedbackResult {
  outcome: PracticeOutcome;
  updated_items: MemoryItem[];
  results: ApplySignalResult[];
}

export function usePracticeFeedback(
  userId: string | null | undefined,
): UsePracticeFeedbackResult {
  const storage = useMemoryStorage();
  const clock = useMemoryClock();
  const telemetry = useMemoryTelemetry();

  const [isApplying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const apply = React.useCallback(
    async (
      params: ApplyPracticeFeedbackParams,
    ): Promise<ApplyPracticeFeedbackResult> => {
      if (!userId) throw new Error("usePracticeFeedback.apply: missing userId");
      setApplying(true);
      setError(null);
      try {
        const now = clock.now();
        const surface = params.surface ?? "smart_summary";
        const source_type: SourceType =
          params.source_type ?? "practice_feedback";

        // `same` is a no-op per SSOT D.5.1 (no row for `practice_same`).
        if (params.outcome === "same" || params.item_ids.length === 0) {
          telemetry.capture("memory.practice_feedback_submitted", {
            user_id: userId,
            outcome: params.outcome,
            item_count: params.item_ids.length,
            practice_type: params.practice_type,
          });
          return { outcome: params.outcome, updated_items: [], results: [] };
        }

        const results: ApplySignalResult[] = [];
        const signal_id =
          params.outcome === "better" ? "practice_better" : "practice_worse";

        for (const itemId of params.item_ids) {
          const items = await storage.getMemoryItems(userId);
          const item = items.find((i) => i.id === itemId);
          if (!item) continue;

          const result = await persistSignalToItem(storage, {
            item,
            signal_id,
            now,
            source_event_id: params.session_id,
            source_type,
            session_id: params.session_id,
            context_surface: surface,
          });
          results.push(result);
        }

        telemetry.capture("memory.practice_feedback_submitted", {
          user_id: userId,
          outcome: params.outcome,
          item_count: results.length,
          practice_type: params.practice_type,
        });

        return {
          outcome: params.outcome,
          updated_items: results.map((r) => r.item),
          results,
        };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setApplying(false);
      }
    },
    [userId, storage, clock, telemetry],
  );

  return { apply, isApplying, error };
}
