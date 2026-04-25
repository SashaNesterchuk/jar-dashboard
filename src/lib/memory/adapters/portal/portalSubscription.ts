/**
 * Portal `SubscriptionAdapter` + `usePortalSubscription()` hook.
 *
 * Spec §0.5 — API is identical to `jar/hooks/useSubscriptions.ts`
 * (minus RevenueCat-specific `customerInfo`). Porting to RN means
 * pointing `SubscriptionAdapter` at `useSubscriptions` there; no
 * changes in memory logic.
 */

"use client";

import { useSyncExternalStore } from "react";
import type { SubscriptionAdapter } from "../subscription";
import {
  createSubscriptionStore,
  type StorageLike,
  type SubscriptionStore,
} from "./subscriptionStore";

function resolveStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const store: SubscriptionStore = createSubscriptionStore(resolveStorage());

/**
 * Hook — returns the same shape as `jar/hooks/useSubscriptions.ts`.
 */
export function usePortalSubscription(): Required<SubscriptionAdapter> {
  const state = useSyncExternalStore(
    (onChange) => store.subscribe(onChange),
    () => store.getState(),
    () => ({ isPremiumActive: false, testSubscriptionOn: false }),
  );

  return {
    isPremiumActive: state.isPremiumActive,
    testSubscriptionOn: state.testSubscriptionOn,
    setTestSubscriptionOn: (value?: boolean) =>
      store.setTestSubscriptionOn(value),
  };
}

/**
 * Non-hook factory: builds an object shaped like `SubscriptionAdapter`
 * from the current store snapshot. Useful in non-component code paths
 * (server-side prefetch, test scaffolding).
 */
export function snapshotPortalSubscription(): SubscriptionAdapter {
  const state = store.getState();
  return {
    isPremiumActive: state.isPremiumActive,
    testSubscriptionOn: state.testSubscriptionOn,
    setTestSubscriptionOn: (value?: boolean) =>
      store.setTestSubscriptionOn(value),
  };
}

export const __portalSubscriptionStore: SubscriptionStore = store;
