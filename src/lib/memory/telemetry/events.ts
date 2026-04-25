/**
 * Typed telemetry helpers for memory surfaces — SSOT E.12.1.
 *
 * Thin wrappers over the `TelemetryAdapter.capture()` calls so UI /
 * hooks do not re-type the payload shape. Every helper emits a single
 * event name from SSOT E.12.1 (memory family) or its memory-internal
 * namespaced cousin declared in `adapters/telemetry.ts`.
 *
 * Pure — no React imports. Consumers bind the adapter through the
 * memory context.
 */

import type {
  MemoryTelemetryEvent,
  TelemetryAdapter,
} from "../adapters/telemetry";
import type { ContextSurface, MemoryItem } from "../types";

export interface MemoryScreenOpenedPayload {
  user_id: string;
  visible_item_count: number;
  confirmed_insight_count: number;
  hypothesis_count: number;
  observation_count: number;
  boundaries_count: number;
  is_premium: boolean;
  under_recalibration: boolean;
}

export function emitMemoryScreenOpened(
  telemetry: TelemetryAdapter,
  payload: MemoryScreenOpenedPayload,
): void {
  telemetry.capture("memory_screen_opened", {
    ...payload,
    at: new Date().toISOString(),
  });
}

export interface MemoryFeedbackSubmittedPayload {
  user_id: string;
  memory_item_id: string;
  action: "yes_that_fits" | "not_quite" | "not_anymore" | "hide";
  context_surface: ContextSurface;
}

/**
 * Wrapper around the `memory_feedback_submitted` event emitted inside
 * `feedback/apply.ts`. UI callers who need to emit the event
 * standalone (e.g. Smart Summary insight chips per SSOT C.4.4) can go
 * through this helper instead of re-typing the payload shape.
 */
export function emitMemoryFeedbackSubmitted(
  telemetry: TelemetryAdapter,
  payload: MemoryFeedbackSubmittedPayload,
): void {
  telemetry.capture("memory_feedback_submitted", {
    ...payload,
    at: new Date().toISOString(),
  });
}

/** Namespaced internal events are re-exported for convenience. */
export type { MemoryTelemetryEvent };

/**
 * Derive the payload for `memory_screen_opened` from the rendered
 * memory view. Kept pure so both the hook and tests can call it.
 */
export function buildScreenOpenedPayload(input: {
  user_id: string;
  is_premium: boolean;
  under_recalibration: boolean;
  confirmed: readonly MemoryItem[];
  hypotheses: readonly MemoryItem[];
  observations: readonly MemoryItem[];
  boundaries: readonly MemoryItem[];
}): MemoryScreenOpenedPayload {
  return {
    user_id: input.user_id,
    is_premium: input.is_premium,
    under_recalibration: input.under_recalibration,
    confirmed_insight_count: input.confirmed.length,
    hypothesis_count: input.hypotheses.length,
    observation_count: input.observations.length,
    boundaries_count: input.boundaries.length,
    visible_item_count:
      input.confirmed.length +
      input.hypotheses.length +
      input.observations.length +
      input.boundaries.length,
  };
}
