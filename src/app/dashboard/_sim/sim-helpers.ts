"use client";

/**
 * Tiny utilities shared by the EPIC 7 simulators (onboarding /
 * check-in / practice / reflection). These live under `_sim/` so they
 * never ship to `jar/` on port — the folder is portal-only.
 */

import * as React from "react";

const SIM_USER_KEY = "mindjar.sim.user_id:v1";

/**
 * Stable dev user id — reused across the four simulator pages so that
 * onboarding, check-in, reflection and practice feed the same memory
 * store and the DoD E2E can be observed manually.
 */
export function useSimUserId(): [string | null, (next: string) => void] {
  const [id, setId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = window.localStorage.getItem(SIM_USER_KEY);
    if (existing && existing.trim().length > 0) {
      setId(existing);
      return;
    }
    const generated = generateUuid();
    window.localStorage.setItem(SIM_USER_KEY, generated);
    setId(generated);
  }, []);

  const update = React.useCallback((next: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIM_USER_KEY, next);
    }
    setId(next);
  }, []);

  return [id, update];
}

export function generateUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes; not crypto-strong but sufficient for
  // local simulator state.
  return "sim-" + Math.random().toString(36).slice(2, 10);
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export const SIM_CLIENT_METADATA = {
  app_version: "portal-sim-0.1",
  locale: "en",
  timezone_offset: "+00:00",
};
