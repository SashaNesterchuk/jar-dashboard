"use client";

/**
 * `useSmartSummary(userId)` — runs the Smart Summary orchestrator
 * through the injected adapters. SSOT E.7 + E.9.
 *
 * The hook:
 *   - Retrieves memory context via `retrieve()` (EPIC 4).
 *   - Loads last 3 session summaries + stable profile.
 *   - Builds `GenerateSmartSummaryParams` and calls the pure
 *     `generateSmartSummary()` orchestrator.
 *   - Tracks result / regeneration count / safety flag locally so the
 *     UI can render the surface and its feedback controls (C.4.4).
 */

import * as React from "react";
import type { SmartSummaryOutput } from "../adapters";
import {
  generateSmartSummary,
  type SmartSummaryRunResult,
  type SmartSummaryTerminalReason,
} from "../generation/smartSummary";
import { retrieve } from "../retrieval/retrieve";
import type { RetrievalIntent } from "../retrieval/relevance";
import type { SessionCard, SessionSummaryV1Sync } from "../types";
import {
  useMemoryAI,
  useMemoryClock,
  useMemoryStorage,
  useMemorySubscription,
  useMemoryTelemetry,
} from "./useMemoryContext";

export interface UseSmartSummaryResult {
  output: SmartSummaryOutput | null;
  reason: SmartSummaryTerminalReason | null;
  regenerationsUsed: number;
  safetyTimedOut: boolean;
  isGenerating: boolean;
  error: Error | null;
  generate: (params: GenerateArgs) => Promise<SmartSummaryRunResult>;
  reset: () => void;
}

export interface GenerateArgs {
  session_card: SessionCard;
  /**
   * Intent for retrieval. If omitted the hook derives it from the
   * session card's `selected_triggers` + `selected_emotions`.
   */
  intent?: RetrievalIntent;
  /** Override the last-3 summary list; useful for tests. */
  recent_summaries?: readonly SessionSummaryV1Sync[];
}

export function useSmartSummary(
  userId: string | null | undefined,
): UseSmartSummaryResult {
  const storage = useMemoryStorage();
  const ai = useMemoryAI();
  const clock = useMemoryClock();
  const telemetry = useMemoryTelemetry();
  const subscription = useMemorySubscription();

  const [output, setOutput] = React.useState<SmartSummaryOutput | null>(null);
  const [reason, setReason] =
    React.useState<SmartSummaryTerminalReason | null>(null);
  const [regenerationsUsed, setRegenerationsUsed] = React.useState(0);
  const [safetyTimedOut, setSafetyTimedOut] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const generate = React.useCallback(
    async (args: GenerateArgs): Promise<SmartSummaryRunResult> => {
      if (!userId) throw new Error("useSmartSummary.generate: missing userId");
      setIsGenerating(true);
      setError(null);
      try {
        const intent: RetrievalIntent = args.intent ?? {
          theme_tags: args.session_card.selected_triggers.map((t) => t.label),
          session_mentioned_topics: args.session_card.selected_triggers.map(
            (t) => t.label,
          ),
        };

        const [retrieval, profile, recent] = await Promise.all([
          retrieve({
            userId,
            surface: "smart_summary_post_checkin",
            intent,
            storage,
            clock,
            telemetry,
          }),
          storage.getStableProfile(userId),
          args.recent_summaries
            ? Promise.resolve(args.recent_summaries)
            : storage.getRecentSessionSummaries(userId, 3),
        ]);

        const run = await generateSmartSummary(
          { ai, clock, telemetry },
          {
            session_card: args.session_card,
            memory_items: retrieval.selected.map((r) => r.item),
            recent_summaries: recent,
            stable_profile: profile,
            avoided_topics:
              profile?.current_constraints.avoided_topics ?? [],
            is_premium: subscription.isPremiumActive,
          },
        );

        setOutput(run.output);
        setReason(run.reason);
        setRegenerationsUsed(run.regenerations_used);
        setSafetyTimedOut(run.safety_timed_out);

        telemetry.capture("smart_summary_viewed", {
          user_id: userId,
          session_id: args.session_card.session_id,
          reason: run.reason,
          regenerations_used: run.regenerations_used,
          safety_flag: run.output.safety_flag,
        });

        return run;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    [userId, storage, ai, clock, telemetry, subscription],
  );

  const reset = React.useCallback(() => {
    setOutput(null);
    setReason(null);
    setRegenerationsUsed(0);
    setSafetyTimedOut(false);
    setError(null);
  }, []);

  return {
    output,
    reason,
    regenerationsUsed,
    safetyTimedOut,
    isGenerating,
    error,
    generate,
    reset,
  };
}
