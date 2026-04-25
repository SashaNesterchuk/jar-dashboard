"use client";

/**
 * `useMemoryItems(userId, filter?)`
 *
 * Reads memory items through the injected `StorageAdapter`, applying a
 * canonical per-item `active_confidence` recompute on every fetch
 * (SSOT D.4.3 — the retrieval path never trusts the cached value).
 *
 * The hook is intentionally minimal. Consumers that need surface-aware
 * ranking should use `useRetrieve()` instead; this hook is the base
 * read for the memory screen (EPIC 8) and for debug panels.
 */

import * as React from "react";
import type { MemoryItem } from "../types";
import type { MemoryItemFilter } from "../adapters/storage";
import { recomputeActiveConfidence } from "../retrieval/relevance";
import { useMemoryClock, useMemoryStorage } from "./useMemoryContext";

export interface UseMemoryItemsResult {
  items: MemoryItem[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useMemoryItems(
  userId: string | null | undefined,
  filter?: MemoryItemFilter,
): UseMemoryItemsResult {
  const storage = useMemoryStorage();
  const clock = useMemoryClock();
  const [items, setItems] = React.useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  // Stable serialisation of the filter so callers can pass an inline
  // object without triggering an effect loop.
  const filterKey = JSON.stringify(filter ?? {});

  const refresh = React.useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const parsed: MemoryItemFilter | undefined = filterKey === "{}"
        ? undefined
        : (JSON.parse(filterKey) as MemoryItemFilter);
      const raw = await storage.getMemoryItems(userId, parsed);
      const now = clock.now();
      const hydrated = raw.map((item) => ({
        ...item,
        active_confidence: recomputeActiveConfidence(item, now),
        last_confidence_computed_at: now.toISOString(),
      }));
      setItems(hydrated);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [userId, storage, clock, filterKey]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, isLoading, error, refresh };
}
