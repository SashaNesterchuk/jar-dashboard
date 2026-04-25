"use client";

/**
 * `useDailySnapshot(userId)` — read/refresh the daily snapshot
 * (SSOT E.5) and expose the soft re-validation flag (SSOT E.5.1).
 *
 * Caller supplies activity inputs (rings state, streak, practices
 * counts) because those come from the app-specific session stores that
 * are outside of the memory layer. The hook handles persistence,
 * dedupe by `date`, and inline refresh when the stored snapshot is
 * older than two hours (SSOT E.5 — "Inline refresh при першому
 * session_open дня — допустимий, якщо snapshot > 2 год").
 */

import * as React from "react";
import type { DailySnapshot } from "../types";
import {
  computeDailySnapshot,
  dateKey,
  needsSoftRevalidation,
  type SnapshotComputeInputs,
} from "../async/snapshot";
import { useMemoryClock, useMemoryStorage } from "./useMemoryContext";

export interface UseDailySnapshotResult {
  snapshot: DailySnapshot | null;
  needsSoftRevalidation: boolean;
  /**
   * True when the stored snapshot is older than the SSOT E.5 inline
   * refresh threshold (2 hours). Consumers should call `recompute()`
   * on first session_open of the day when this is true.
   */
  isStale: boolean;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  recompute: (
    inputs: Omit<SnapshotComputeInputs, "userId" | "now" | "previous">,
  ) => Promise<DailySnapshot>;
}

const INLINE_REFRESH_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours — SSOT E.5.

export function useDailySnapshot(
  userId: string | null | undefined,
): UseDailySnapshotResult {
  const storage = useMemoryStorage();
  const clock = useMemoryClock();

  const [snapshot, setSnapshot] = React.useState<DailySnapshot | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    if (!userId) {
      setSnapshot(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const today = dateKey(clock.now());
      const s = await storage.getDailySnapshot(userId, today);
      setSnapshot(s);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [userId, storage, clock]);

  const recompute = React.useCallback(
    async (
      inputs: Omit<SnapshotComputeInputs, "userId" | "now" | "previous">,
    ): Promise<DailySnapshot> => {
      if (!userId) {
        throw new Error("useDailySnapshot.recompute: missing userId");
      }
      setIsLoading(true);
      setError(null);
      try {
        const today = dateKey(clock.now());
        const previous = await storage.getDailySnapshot(userId, today);
        const next = computeDailySnapshot({
          ...inputs,
          userId,
          now: clock.now(),
          previous,
        });
        await storage.upsertDailySnapshot(next);
        setSnapshot(next);
        return next;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, storage, clock],
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const softRevalidation = React.useMemo(
    () => (snapshot ? needsSoftRevalidation(snapshot) : false),
    [snapshot],
  );

  const isStale = React.useMemo(() => {
    if (!snapshot) return false;
    const age = clock.now().getTime() - new Date(snapshot.refreshed_at).getTime();
    return age >= INLINE_REFRESH_STALE_MS;
  }, [snapshot, clock]);

  return {
    snapshot,
    needsSoftRevalidation: softRevalidation,
    isStale,
    isLoading,
    error,
    refresh,
    recompute,
  };
}
