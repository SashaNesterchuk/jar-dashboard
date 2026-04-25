"use client";

/**
 * `<PremiumToggle />` — portal shell control for the premium
 * switcher described in Spec §0.5.
 *
 * Semantics match `jar/hooks/useSubscriptions.ts`:
 *   - Reads `isPremiumActive` + `testSubscriptionOn` from the memory
 *     `SubscriptionAdapter`.
 *   - Calls `setTestSubscriptionOn()` to flip the boolean; the store
 *     persists the value through `localStorage`.
 *
 * On mount and on every toggle the component emits a
 * `memory.premium_toggled` event via the `TelemetryAdapter`. In the
 * default portal setup that resolves to `console.debug` in dev and a
 * no-op in prod, so it never reaches production analytics.
 */

import * as React from "react";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import {
  useMemoryContext,
  useMemorySubscription,
} from "../hooks/useMemoryContext";

export interface PremiumToggleProps {
  /** Visual variant — fixed badge in header vs inline. */
  variant?: "badge" | "inline";
  className?: string;
}

export function PremiumToggle({
  variant = "badge",
  className,
}: PremiumToggleProps) {
  const { subscription, telemetry } = useMemoryContext();
  // Read the state via the dedicated hook so tests can swap adapters.
  const adapter = useMemorySubscription();
  const isActive = adapter.isPremiumActive;

  const handleToggle = React.useCallback(
    (next: boolean) => {
      if (!subscription.setTestSubscriptionOn) return;
      subscription.setTestSubscriptionOn(next);
      telemetry.capture("memory.premium_toggled", {
        next_state: next ? "on" : "off",
      });
    },
    [subscription, telemetry],
  );

  if (variant === "badge") {
    return (
      <div
        className={cn(
          "fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur",
          className,
        )}
        role="group"
        aria-label="Portal premium toggle"
      >
        <span className="font-medium uppercase tracking-wide text-muted-foreground">
          Premium
        </span>
        <Toggle
          size="sm"
          pressed={isActive}
          onPressedChange={handleToggle}
          aria-label={isActive ? "Disable premium" : "Enable premium"}
          variant="outline"
          className={cn(
            "h-7 min-w-[3.25rem] rounded-full px-2 text-xs font-semibold",
            isActive
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isActive ? "ON" : "OFF"}
        </Toggle>
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-2 text-xs", className)}
      role="group"
      aria-label="Portal premium toggle"
    >
      <span className="font-medium uppercase tracking-wide text-muted-foreground">
        Premium
      </span>
      <Toggle
        size="sm"
        pressed={isActive}
        onPressedChange={handleToggle}
        aria-label={isActive ? "Disable premium" : "Enable premium"}
        variant="outline"
      >
        {isActive ? "ON" : "OFF"}
      </Toggle>
    </div>
  );
}
