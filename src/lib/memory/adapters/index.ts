/**
 * Barrel for memory adapter interfaces.
 *
 * Everything exported here is PURE — no React, no Next, no DOM. Both
 * the portal and mobile app implement these interfaces using
 * platform-specific means.
 */

export type { ClockAdapter } from "./clock";
export type { SubscriptionAdapter } from "./subscription";
export type {
  MemoryTelemetryEvent,
  TelemetryAdapter,
} from "./telemetry";
export type {
  AIAdapter,
  EnrichmentInput,
  SafetyInput,
  SafetyResult,
  SmartSummaryInput,
  SmartSummaryOutput,
} from "./ai";
export type {
  MemoryItemFilter,
  StorageAdapter,
} from "./storage";
