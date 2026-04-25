"use client";

/**
 * `useSafetyClassifier()` — minimal UI seam on top of the pure
 * `runSafetyClassifier` orchestrator (SSOT F.1).
 *
 * Exposes a `classify(text, ctx)` function. The Smart Summary hook
 * already calls the classifier internally; this hook exists for
 * surfaces that need stand-alone safety checks (e.g. Chat reply
 * preview, memory-screen inline text, dev tools).
 */

import * as React from "react";
import type { SafetyResult } from "../adapters";
import type { Surface } from "../types";
import { runSafetyClassifier } from "../safety/classifier";
import {
  useMemoryAI,
  useMemoryClock,
  useMemoryTelemetry,
} from "./useMemoryContext";

export interface ClassifyArgs {
  text: string;
  surface: Surface;
  user_id: string;
  session_id?: string | null;
  avoided_topics?: readonly string[];
  mood?: string;
  themes?: readonly string[];
  recent_signals?: readonly string[];
}

export interface UseSafetyClassifierResult {
  classify: (args: ClassifyArgs) => Promise<SafetyResult>;
  lastResult: SafetyResult | null;
  lastTimedOut: boolean;
  isClassifying: boolean;
  error: Error | null;
}

export function useSafetyClassifier(): UseSafetyClassifierResult {
  const ai = useMemoryAI();
  const clock = useMemoryClock();
  const telemetry = useMemoryTelemetry();

  const [lastResult, setLastResult] = React.useState<SafetyResult | null>(null);
  const [lastTimedOut, setLastTimedOut] = React.useState(false);
  const [isClassifying, setIsClassifying] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const classify = React.useCallback(
    async (args: ClassifyArgs): Promise<SafetyResult> => {
      setIsClassifying(true);
      setError(null);
      try {
        const run = await runSafetyClassifier({
          ai,
          clock,
          telemetry,
          input: {
            text: args.text,
            avoided_topics: args.avoided_topics ?? [],
            user_state: {
              mood: args.mood,
              themes: args.themes,
              recent_signals: args.recent_signals,
            },
          },
          surface: args.surface,
          user_id: args.user_id,
          session_id: args.session_id ?? null,
          output_for_hash: args.text,
        });
        setLastResult(run.result);
        setLastTimedOut(run.timed_out);
        return run.result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsClassifying(false);
      }
    },
    [ai, clock, telemetry],
  );

  return {
    classify,
    lastResult,
    lastTimedOut,
    isClassifying,
    error,
  };
}
