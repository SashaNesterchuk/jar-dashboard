"use client";

/**
 * `useRecalibrationBanner(userId)` — SSOT D.7 helper for the Memory
 * screen banner.
 *
 * The hook reads the most recent session card for the user through the
 * `StorageAdapter` via `getRecentSessionSummaries` (D.7 keys off the
 * last check-in completion), computes `days_since_last_checkin` and
 * exposes:
 *
 *   - `underRecalibration: boolean` — `true` when the pause exceeds
 *     `RECALIBRATION_PAUSE_DAYS` (SSOT D.7 threshold = 7).
 *   - `daysSinceLastCheckin: number | null`
 *   - `copy: { banner: string, returnPrompt: string }` — verbatim
 *     strings from `state/recalibration.ts`.
 *   - `refresh()` / `error`.
 *
 * Pure read — no side effects. Persisting the "cleared" flag is the
 * caller's job (done inside `useSessionSubmit` via
 * `clearsRecalibration`).
 */

import * as React from "react";
import {
  RECALIBRATION_COPY,
  isPauseExceeded,
} from "../state/recalibration";
import { daysBetween } from "../state/decay";
import { useMemoryClock, useMemoryStorage } from "./useMemoryContext";

export interface UseRecalibrationBannerResult {
  underRecalibration: boolean;
  daysSinceLastCheckin: number | null;
  copy: typeof RECALIBRATION_COPY;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useRecalibrationBanner(
  userId: string | null | undefined,
): UseRecalibrationBannerResult {
  const storage = useMemoryStorage();
  const clock = useMemoryClock();

  const [daysSinceLastCheckin, setDays] = React.useState<number | null>(null);
  const [isLoading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    if (!userId) {
      setDays(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const recent = await storage.getRecentSessionSummaries(userId, 1);
      if (recent.length === 0) {
        setDays(null);
        return;
      }
      const last = new Date(recent[0].completed_at);
      const days = daysBetween(last, clock.now());
      setDays(days);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [userId, storage, clock]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const underRecalibration =
    daysSinceLastCheckin !== null && isPauseExceeded(daysSinceLastCheckin);

  return {
    underRecalibration,
    daysSinceLastCheckin,
    copy: RECALIBRATION_COPY,
    isLoading,
    error,
    refresh,
  };
}
