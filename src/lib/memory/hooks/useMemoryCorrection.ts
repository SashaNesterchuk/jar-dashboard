"use client";

/**
 * `useMemoryCorrection(userId)` — rollback within 24h (SSOT D.2.4).
 *
 *   `rollback({ itemId })` → finds the most recent revertible audit
 *   event on the item (`soft_reject` / `mark_stale` / `hide`) and
 *   calls `persistRollback()`; returns the decision + restored item.
 *
 * Returns `{ allowed: false, verdict }` when no revertible entry
 * exists or when the window has elapsed; UI decides how to render.
 */

import * as React from "react";
import {
  persistRollback,
  type RollbackResult,
} from "../feedback/correction";
import { canRollback } from "../state/rollback";
import { ROLLBACK_WINDOW_HOURS } from "../constants";
import type { MemoryAuditEvent, MemoryItem } from "../types";
import {
  useMemoryClock,
  useMemoryStorage,
  useMemoryTelemetry,
} from "./useMemoryContext";

export interface UseMemoryCorrectionResult {
  rollback: (args: RollbackArgs) => Promise<RollbackResult>;
  inspect: (args: RollbackArgs) => Promise<RollbackEligibility>;
  isApplying: boolean;
  error: Error | null;
}

export interface RollbackArgs {
  itemId: string;
}

export interface RollbackEligibility {
  allowed: boolean;
  reason: string;
  window_hours: number;
  audit: MemoryAuditEvent | null;
}

const REVERTIBLE_ACTIONS: ReadonlySet<MemoryAuditEvent["action"]> = new Set([
  "soft_reject",
  "mark_stale",
  "hide",
]);

export function useMemoryCorrection(
  userId: string | null | undefined,
): UseMemoryCorrectionResult {
  const storage = useMemoryStorage();
  const clock = useMemoryClock();
  const telemetry = useMemoryTelemetry();

  const [isApplying, setIsApplying] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const resolve = React.useCallback(
    async (
      itemId: string,
    ): Promise<{
      item: MemoryItem | null;
      lastRevertible: MemoryAuditEvent | null;
    }> => {
      if (!userId) {
        throw new Error("useMemoryCorrection: missing userId");
      }
      const [items, audit] = await Promise.all([
        storage.getMemoryItems(userId),
        storage.getAuditTrail(itemId),
      ]);
      const item = items.find((i) => i.id === itemId) ?? null;
      const lastRevertible =
        [...audit]
          .reverse()
          .find((evt) => REVERTIBLE_ACTIONS.has(evt.action)) ?? null;
      return { item, lastRevertible };
    },
    [userId, storage],
  );

  const inspect = React.useCallback(
    async (args: RollbackArgs): Promise<RollbackEligibility> => {
      const { item, lastRevertible } = await resolve(args.itemId);
      if (!item || !lastRevertible) {
        return {
          allowed: false,
          reason: "no revertible action found",
          window_hours: ROLLBACK_WINDOW_HOURS,
          audit: lastRevertible,
        };
      }
      const result = canRollback(lastRevertible, clock.now());
      return {
        allowed: result.allowed,
        reason: result.reason,
        window_hours: result.window_hours,
        audit: lastRevertible,
      };
    },
    [resolve, clock],
  );

  const rollback = React.useCallback(
    async (args: RollbackArgs): Promise<RollbackResult> => {
      setIsApplying(true);
      setError(null);
      try {
        const { item, lastRevertible } = await resolve(args.itemId);
        if (!item) throw new Error(`memory item ${args.itemId} not found`);
        if (!lastRevertible) {
          return {
            allowed: false,
            verdict: {
              allowed: false,
              reason: "no revertible action found",
              window_hours: ROLLBACK_WINDOW_HOURS,
            },
          };
        }
        return await persistRollback(
          { storage, telemetry },
          {
            item,
            audit: lastRevertible,
            now: clock.now(),
          },
        );
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsApplying(false);
      }
    },
    [storage, telemetry, clock, resolve],
  );

  return { rollback, inspect, isApplying, error };
}
