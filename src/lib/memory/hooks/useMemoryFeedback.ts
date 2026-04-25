"use client";

/**
 * `useMemoryFeedback(userId)` — SSOT C.3.4 reaction controls bound
 * to the memory layer.
 *
 * Exposes `submit({ item, action, context_surface? })` which applies
 * the corresponding signal (via `feedback/apply.ts`) and persists the
 * item + audit atomically through the StorageAdapter.
 */

import * as React from "react";
import {
  persistFeedback,
  type MemoryFeedbackAction,
} from "../feedback/apply";
import type { ApplySignalResult } from "../async/itemUpsert";
import type { ContextSurface, MemoryItem } from "../types";
import {
  useMemoryClock,
  useMemoryStorage,
  useMemoryTelemetry,
} from "./useMemoryContext";

export interface UseMemoryFeedbackResult {
  submit: (args: SubmitArgs) => Promise<ApplySignalResult>;
  isSubmitting: boolean;
  error: Error | null;
}

export interface SubmitArgs {
  item: MemoryItem;
  action: MemoryFeedbackAction;
  context_surface?: ContextSurface;
}

export function useMemoryFeedback(
  userId: string | null | undefined,
): UseMemoryFeedbackResult {
  const storage = useMemoryStorage();
  const clock = useMemoryClock();
  const telemetry = useMemoryTelemetry();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const submit = React.useCallback(
    async (args: SubmitArgs): Promise<ApplySignalResult> => {
      if (!userId) throw new Error("useMemoryFeedback.submit: missing userId");
      if (args.item.user_id !== userId) {
        throw new Error(
          "useMemoryFeedback: item.user_id does not match hook userId",
        );
      }
      setIsSubmitting(true);
      setError(null);
      try {
        return await persistFeedback(
          { storage, telemetry },
          {
            item: args.item,
            action: args.action,
            now: clock.now(),
            context_surface: args.context_surface,
          },
        );
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, storage, clock, telemetry],
  );

  return { submit, isSubmitting, error };
}
