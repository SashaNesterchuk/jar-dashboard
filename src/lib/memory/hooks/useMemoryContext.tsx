"use client";

/**
 * `<MemoryProvider>` + `useMemoryContext()` — DI surface for the memory
 * layer.
 *
 * Spec §3.6. The provider accepts all 5 adapters. Every memory hook
 * (EPIC 4+) reads them through `useMemoryContext()`. Porting to RN
 * means swapping the adapter set; the hook tree itself is unchanged.
 *
 * The default adapter set used by the portal is assembled here (via
 * `createDefaultMemoryAdapters()`); tests build a custom set with
 * stubs.
 */

import * as React from "react";
import type {
  AIAdapter,
  ClockAdapter,
  StorageAdapter,
  SubscriptionAdapter,
  TelemetryAdapter,
} from "../adapters";
import { InMemoryStorageAdapter } from "../adapters/portal/inMemoryStorage";
import { edgeApiAIAdapter } from "../adapters/portal/edgeAIApi";
import { createPortalTelemetryAdapter } from "../adapters/portal/portalTelemetry";
import {
  snapshotPortalSubscription,
  usePortalSubscription,
} from "../adapters/portal/portalSubscription";
import { systemClock } from "../adapters/portal/systemClock";
import type { StorageLike } from "../adapters/portal/subscriptionStore";

export interface MemoryAdapters {
  storage: StorageAdapter;
  subscription: SubscriptionAdapter;
  ai: AIAdapter;
  telemetry: TelemetryAdapter;
  clock: ClockAdapter;
}

const MemoryContext = React.createContext<MemoryAdapters | null>(null);

function resolvePortalStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Build the default portal adapter set. Synchronous: safe to call in
 * render. SSR-safe: `window` is not touched when unavailable.
 */
export function createDefaultMemoryAdapters(
  overrides: Partial<MemoryAdapters> = {},
): MemoryAdapters {
  return {
    storage:
      overrides.storage ??
      new InMemoryStorageAdapter({ storage: resolvePortalStorage() }),
    subscription: overrides.subscription ?? snapshotPortalSubscription(),
    ai: overrides.ai ?? edgeApiAIAdapter,
    telemetry: overrides.telemetry ?? createPortalTelemetryAdapter(),
    clock: overrides.clock ?? systemClock,
  };
}

export interface MemoryProviderProps {
  children: React.ReactNode;
  /** Override any adapter (tests, Storybook, mobile port). */
  adapters?: Partial<MemoryAdapters>;
  /**
   * When true (default) the subscription adapter is taken from
   * `usePortalSubscription()` so changes in the toggle propagate into
   * memory-hook reads. Tests set this to `false` and inject their own.
   */
  bindPortalSubscription?: boolean;
}

export function MemoryProvider({
  children,
  adapters,
  bindPortalSubscription = true,
}: MemoryProviderProps) {
  // Keep the non-subscription adapters stable across renders. We
  // initialise once via lazy useState so the factory runs only on
  // the first render, but the resulting value is still tracked by
  // React (no ref-in-render violations).
  const [base] = React.useState<MemoryAdapters>(() =>
    createDefaultMemoryAdapters(adapters),
  );

  const portalSub = usePortalSubscription();

  const value = React.useMemo<MemoryAdapters>(() => {
    if (adapters?.subscription || !bindPortalSubscription) {
      return { ...base, ...adapters } as MemoryAdapters;
    }
    return { ...base, ...adapters, subscription: portalSub };
  }, [base, adapters, bindPortalSubscription, portalSub]);

  return (
    <MemoryContext.Provider value={value}>{children}</MemoryContext.Provider>
  );
}

export function useMemoryContext(): MemoryAdapters {
  const ctx = React.useContext(MemoryContext);
  if (!ctx) {
    throw new Error(
      "useMemoryContext must be used inside <MemoryProvider>. Check the dashboard layout.",
    );
  }
  return ctx;
}

export function useMemorySubscription(): SubscriptionAdapter {
  return useMemoryContext().subscription;
}

export function useMemoryStorage(): StorageAdapter {
  return useMemoryContext().storage;
}

export function useMemoryClock(): ClockAdapter {
  return useMemoryContext().clock;
}

export function useMemoryTelemetry(): TelemetryAdapter {
  return useMemoryContext().telemetry;
}

export function useMemoryAI(): AIAdapter {
  return useMemoryContext().ai;
}
