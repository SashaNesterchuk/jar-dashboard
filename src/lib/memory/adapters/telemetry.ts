/**
 * TelemetryAdapter — platform boundary for analytics.
 *
 * Spec §3.4. Event name enum is derived from SSOT E.12.1 Core event
 * families (plus memory-specific internal events). Portal-side default
 * implementation is a no-op / console.debug (see
 * `adapters/portal/portalTelemetry.ts`) so running the smoke tests
 * never pollutes production analytics.
 */

/**
 * Memory-related telemetry events. Names taken verbatim from SSOT
 * E.12.1 where applicable; memory-internal events (e.g.
 * `retrieval_contradiction`, SSOT E.6.4) are namespaced in the
 * `memory.*` prefix to make them easy to filter out of dashboards.
 */
export type MemoryTelemetryEvent =
  // Session lifecycle — SSOT E.12.1
  | "session_started"
  | "session_completed"
  | "session_abandoned"
  | "check_in_completed"
  // Summary & feedback — SSOT E.12.1
  | "smart_summary_viewed"
  | "smart_summary_reaction"
  | "echo_saved"
  // Memory correction loop — SSOT E.12.1
  | "memory_screen_opened"
  | "memory_feedback_submitted"
  // Safety — SSOT E.12.1 + F.1
  | "safety_classifier_completed"
  | "safety_flag_raised"
  | "crisis_flow_shown"
  // Memory-internal (SSOT-derived but not part of E.12.1 core set)
  | "memory.retrieval_contradiction" // SSOT E.6.4
  | "memory.recalibration_applied" // SSOT D.7
  | "memory.recalibration_cleared" // SSOT D.7 #4
  | "memory.state_transition" // SSOT D.2.2
  | "memory.audit_appended" // SSOT D.6
  | "memory.rollback_applied" // SSOT D.2.4
  | "memory.enrichment_completed" // SSOT E.4 v2 / E.7 step 2
  | "memory.enrichment_failed" // SSOT E.4 v2 — AI adapter error path
  | "memory.enrichment_rejected" // SSOT E.4 v2 — forbidden language in v2 output
  | "memory.onboarding_completed" // SSOT C.1.9 / D.1.2 — anketa persisted
  | "memory.practice_feedback_submitted" // SSOT E.4.1 / D.5.1 practice_better/_worse
  | "memory.reflection_submitted" // SSOT D.5.1 reflection_text signal applied
  | "memory.premium_toggled"; // Portal-only: track premium switcher state changes

export interface TelemetryAdapter {
  capture(
    event: MemoryTelemetryEvent,
    payload?: Record<string, unknown>,
  ): void;
}
