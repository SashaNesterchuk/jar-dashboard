"use client";

/**
 * `<PremiumToggleGate />` — intentionally no-op while the dashboard
 * tester keeps memory flows inline inside `/dashboard/ai-test`.
 *
 * Keep the component in the layout so a future dedicated flow route can
 * opt back in without touching the dashboard shell.
 */
export function PremiumToggleGate() {
  return null;
}
