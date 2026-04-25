/**
 * SubscriptionAdapter — premium / free gate.
 *
 * Spec §3.2 and §0.5. API surface is intentionally identical to
 * `jar/hooks/useSubscriptions.ts` so porting to RN means swapping the
 * data source, nothing more.
 */

export interface SubscriptionAdapter {
  isPremiumActive: boolean;
  /** Dev-only toggle; on portal always available, on mobile `__DEV__`-gated. */
  setTestSubscriptionOn?: (value?: boolean) => void;
  testSubscriptionOn?: boolean;
}
