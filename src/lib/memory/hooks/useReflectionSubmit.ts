"use client";

/**
 * `useReflectionSubmit(userId)` — SSOT D.5.1 `reflection_text`
 * (`+0.20 evidence`, supports `hypothesis`).
 *
 * Two-step pipeline:
 *   1. Persist the reflection as a `SessionCard` (session_type =
 *      `reflection`) via the normal sync path so the session shows up
 *      in retrieval, trends, and the daily snapshot.
 *   2. Apply `reflection_text` as corroboration to any existing memory
 *      items whose `theme_tags` intersect with the reflection's
 *      `selected_triggers`. Items are the candidates the reflection
 *      "speaks about" — D.5.1 row 3 says a single reflection is not
 *      enough to create truth, only to reinforce it.
 *
 * `useSessionSubmit` already owns persistence + Smart Summary, so the
 * reflection hook composes it instead of duplicating logic.
 */

import * as React from "react";
import {
  persistSignalToItem,
  type ApplySignalResult,
} from "../async/itemUpsert";
import type { MemoryItem } from "../types";
import {
  useMemoryClock,
  useMemoryStorage,
  useMemoryTelemetry,
} from "./useMemoryContext";
import {
  useSessionSubmit,
  type SessionSubmitInput,
  type SessionSubmitResult,
} from "./useSessionSubmit";

export interface UseReflectionSubmitResult {
  submit: (
    input: ReflectionSubmitInput,
  ) => Promise<ReflectionSubmitResult>;
  isSubmitting: boolean;
  error: Error | null;
}

export interface ReflectionSubmitInput extends SessionSubmitInput {
  /**
   * Explicit item ids the reflection reinforces. Overrides theme
   * matching. Use when the UI already picked specific memory cards.
   */
  target_item_ids?: readonly string[];
}

export interface ReflectionSubmitResult {
  session: SessionSubmitResult;
  reinforced_items: MemoryItem[];
  signal_results: ApplySignalResult[];
}

export function useReflectionSubmit(
  userId: string | null | undefined,
): UseReflectionSubmitResult {
  const storage = useMemoryStorage();
  const clock = useMemoryClock();
  const telemetry = useMemoryTelemetry();
  const { submit: submitSession, isSubmitting: isSubmittingSession } =
    useSessionSubmit(userId);

  const [isApplying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const submit = React.useCallback(
    async (
      input: ReflectionSubmitInput,
    ): Promise<ReflectionSubmitResult> => {
      if (!userId) throw new Error("useReflectionSubmit: missing userId");
      setApplying(true);
      setError(null);
      try {
        const sessionResult = await submitSession({
          ...input,
          event_type: input.event_type ?? "reflection",
        });

        const targets = await pickTargets(
          storage,
          userId,
          input,
          sessionResult,
        );

        const signalResults: ApplySignalResult[] = [];
        const now = clock.now();
        for (const target of targets) {
          const r = await persistSignalToItem(storage, {
            item: target,
            signal_id: "reflection_text",
            now,
            source_event_id: sessionResult.session_card.session_id,
            source_type: "reflection",
            session_id: sessionResult.session_card.session_id,
            context_surface: "reflection",
          });
          signalResults.push(r);
        }

        telemetry.capture("memory.reflection_submitted", {
          user_id: userId,
          session_id: sessionResult.session_card.session_id,
          reinforced_item_count: signalResults.length,
        });

        return {
          session: sessionResult,
          reinforced_items: signalResults.map((r) => r.item),
          signal_results: signalResults,
        };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setApplying(false);
      }
    },
    [userId, storage, clock, telemetry, submitSession],
  );

  return {
    submit,
    isSubmitting: isApplying || isSubmittingSession,
    error,
  };
}

/* ------------------------------------------------------------ helpers */

async function pickTargets(
  storage: ReturnType<typeof useMemoryStorage>,
  userId: string,
  input: ReflectionSubmitInput,
  session: SessionSubmitResult,
): Promise<MemoryItem[]> {
  const items = await storage.getMemoryItems(userId);

  if (input.target_item_ids && input.target_item_ids.length > 0) {
    const ids = new Set(input.target_item_ids);
    return items.filter((i) => ids.has(i.id));
  }

  const triggers = session.session_card.selected_triggers.map((t) =>
    t.label.toLowerCase(),
  );
  if (triggers.length === 0) return [];

  return items.filter((item) => {
    // SSOT D.5.1 row 3 — reflection can only upgrade a hypothesis.
    if (item.type !== "hypothesis" && item.type !== "observation") return false;
    if (item.status !== "active") return false;
    return item.theme_tags.some((tag) =>
      triggers.some((t) => tag.toLowerCase().includes(t)),
    );
  });
}
