/**
 * Portal `TelemetryAdapter` implementation.
 *
 * Spec §3.4 + memory-epics §EPIC 3 deferred decision:
 *   - Default behavior is a NO-OP in production to keep memory-layer
 *     smoke tests out of production analytics.
 *   - In development (`NODE_ENV !== "production"`) the adapter prints
 *     the event via `console.debug` for observability.
 *   - An optional `sink` callback lets callers plug a real transport
 *     (e.g. `src/app/api/analytics*`) without changing the adapter
 *     contract.
 */

import type {
  MemoryTelemetryEvent,
  TelemetryAdapter,
} from "../telemetry";

export interface PortalTelemetryOptions {
  /** Optional real transport; if unset the adapter is no-op in prod. */
  sink?: (
    event: MemoryTelemetryEvent,
    payload?: Record<string, unknown>,
  ) => void;
  /** `true` if running in a dev-like environment. Defaults to `process.env.NODE_ENV !== "production"`. */
  devMode?: boolean;
  /**
   * Captured events mirror — useful for smoke tests / in-app debug
   * panels. Not persisted anywhere.
   */
  inMemoryLog?: TelemetryRecord[];
}

export interface TelemetryRecord {
  event: MemoryTelemetryEvent;
  payload: Record<string, unknown> | undefined;
  at: string;
}

const DEFAULT_DEV_MODE =
  typeof process !== "undefined" &&
  process?.env?.NODE_ENV !== "production";

export function createPortalTelemetryAdapter(
  options: PortalTelemetryOptions = {},
): TelemetryAdapter & { history: readonly TelemetryRecord[] } {
  const devMode = options.devMode ?? DEFAULT_DEV_MODE;
  const log = options.inMemoryLog ?? [];

  return {
    capture(event, payload) {
      const record: TelemetryRecord = {
        event,
        payload,
        at: new Date().toISOString(),
      };
      log.push(record);

      if (options.sink) {
        try {
          options.sink(event, payload);
        } catch {
          // Swallow sink errors: telemetry must never break the flow.
        }
        return;
      }

      if (devMode) {
        // eslint-disable-next-line no-console
        console.debug("[memory.telemetry]", event, payload ?? {});
      }
      // Production default: intentional no-op (see header comment).
    },
    get history() {
      return log;
    },
  };
}

/**
 * Singleton convenience for places that do not need a custom sink.
 * Tests should prefer `createPortalTelemetryAdapter({ inMemoryLog })`
 * for isolation.
 */
export const portalTelemetry = createPortalTelemetryAdapter();
