"use client";

/**
 * `useStableProfile(userId)` — read/refresh the derived stable profile
 * (SSOT D.8) through the injected `StorageAdapter`.
 *
 * The hook exposes a `recompute(mode)` helper that reads all memory
 * items for the user, runs the pure `recomputeStableProfile()` from
 * `async/profile.ts` with the current clock, and persists the result.
 * It intentionally accepts the confidence inputs and
 * `whatTendsToHelp` from the caller — those aggregations are built
 * elsewhere (async enrichment job in EPIC 5) and we do not want this
 * hook to reach into session storage on its own.
 */

import * as React from "react";
import type {
  ConfidenceScoreInputs,
  DailySnapshot,
  StableProfile,
  StableProfileHelpEntry,
} from "../types";
import {
  recomputeStableProfile,
  type StableProfileMode,
} from "../async/profile";
import {
  useMemoryClock,
  useMemoryStorage,
  useMemoryTelemetry,
} from "./useMemoryContext";

export interface UseStableProfileResult {
  profile: StableProfile | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  recompute: (args: RecomputeArgs) => Promise<StableProfile>;
}

export interface RecomputeArgs {
  mode?: StableProfileMode;
  confidenceInputs: ConfidenceScoreInputs;
  dailySnapshot: DailySnapshot | null;
  whatTendsToHelp?: readonly StableProfileHelpEntry[];
}

export function useStableProfile(
  userId: string | null | undefined,
): UseStableProfileResult {
  const storage = useMemoryStorage();
  const clock = useMemoryClock();
  const telemetry = useMemoryTelemetry();

  const [profile, setProfile] = React.useState<StableProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const p = await storage.getStableProfile(userId);
      setProfile(p);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [userId, storage]);

  const recompute = React.useCallback(
    async (args: RecomputeArgs): Promise<StableProfile> => {
      if (!userId) throw new Error("useStableProfile.recompute: missing userId");
      setIsLoading(true);
      setError(null);
      try {
        const existing = await storage.getStableProfile(userId);
        const items = await storage.getMemoryItems(userId);
        const next = recomputeStableProfile({
          existing,
          userId,
          items,
          dailySnapshot: args.dailySnapshot,
          confidenceInputs: args.confidenceInputs,
          whatTendsToHelp: args.whatTendsToHelp,
          now: clock.now(),
          mode: args.mode,
        });
        await storage.upsertStableProfile(next);
        setProfile(next);
        telemetry.capture("memory.audit_appended", {
          kind: "stable_profile_recompute",
          user_id: userId,
          mode: args.mode ?? "full",
          confidence_level: next.confidence_level,
        });
        return next;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, storage, clock, telemetry],
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, isLoading, error, refresh, recompute };
}
