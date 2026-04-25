/**
 * Pure subscription store used by the portal `SubscriptionAdapter`.
 *
 * Spec §0.5: portal premium switcher is a single boolean persisted in
 * localStorage. This file is deliberately React-free so it can be
 * unit-tested without a DOM and reused by any UI framework.
 *
 * API shape mirrors `jar/hooks/useSubscriptions.ts` semantics:
 *   - `testSubscriptionOn`: dev-only toggle (portal = always dev).
 *   - `isPremiumActive`: effective gate value.
 *   - `setTestSubscriptionOn(v?)`: set / toggle.
 */

const STORAGE_KEY = "mindjar_portal_subscription:testSubscriptionOn";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SubscriptionState {
  isPremiumActive: boolean;
  testSubscriptionOn: boolean;
}

export type SubscriptionListener = (state: SubscriptionState) => void;

export interface SubscriptionStore {
  getState(): SubscriptionState;
  setTestSubscriptionOn(value?: boolean): void;
  subscribe(listener: SubscriptionListener): () => void;
}

export function createSubscriptionStore(
  storage: StorageLike | null,
): SubscriptionStore {
  let state: SubscriptionState = {
    testSubscriptionOn: readFromStorage(storage),
    isPremiumActive: readFromStorage(storage),
  };
  const listeners = new Set<SubscriptionListener>();

  function emit() {
    for (const l of listeners) l(state);
  }

  return {
    getState: () => state,
    setTestSubscriptionOn(value) {
      const next =
        value === undefined ? !state.testSubscriptionOn : Boolean(value);
      if (next === state.testSubscriptionOn) return;
      state = { testSubscriptionOn: next, isPremiumActive: next };
      writeToStorage(storage, next);
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function readFromStorage(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return false;
    return raw === "true";
  } catch {
    return false;
  }
}

function writeToStorage(storage: StorageLike | null, value: boolean): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    // Quota / SSR — ignore; in-memory state remains the source of truth.
  }
}

export const SUBSCRIPTION_STORAGE_KEY = STORAGE_KEY;
