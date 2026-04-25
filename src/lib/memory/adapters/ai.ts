/**
 * AIAdapter — platform boundary for generative AI calls.
 *
 * Spec §3.3. Concrete input/output shapes for Smart Summary,
 * enrichment, and safety classifier are the scope of EPIC 5. EPIC 3
 * only fixes the interface surface so that the MemoryProvider DI
 * skeleton can be assembled now without pulling model-specific types
 * into pure-core.
 *
 * EPIC 5 MUST replace the placeholder types below with final shapes.
 * The file location and interface name stay stable.
 */

import type {
  SafetyEvent,
  SessionCard,
  SessionSummaryV2Enriched,
} from "../types";

/**
 * Placeholder — finalized in EPIC 5 (`sync/summary.ts`).
 * Any field set here today must survive the transition without
 * breaking the MemoryProvider contract.
 */
export interface SmartSummaryInput {
  session_card: SessionCard;
  /** Memory items pre-filtered by EPIC 4 retrieval. */
  memory_items: readonly unknown[];
  /** Session summaries used for context (last 3). */
  recent_summaries: readonly unknown[];
  /** Stable profile subset passed to the LLM. */
  stable_profile: unknown;
  /** User's active confidence level — SSOT D.4.2. */
  confidence_level: "A" | "B" | "C" | "D";
  /** SSOT D.3.2 — topics the user has asked to steer around. */
  avoided_topics: readonly string[];
  /** Portal premium toggle; drives richer/simpler output branching. */
  is_premium: boolean;
}

export interface SmartSummaryOutput {
  advice: string;
  insight: string;
  affirmation: string;
  summary?: string;
  references_used: readonly string[];
  word_count: number;
  regenerated_from?: string;
  safety_flag: SafetyEvent["flag"];
}

export interface EnrichmentInput {
  session_card: SessionCard;
  /** v1_sync summary produced by EPIC 5. */
  sync_summary: unknown;
  /** Recent cross-session context (EPIC 4 retrieval). */
  recent_context: readonly unknown[];
}

export interface SafetyInput {
  text: string;
  avoided_topics: readonly string[];
  user_state: {
    mood?: string;
    themes?: readonly string[];
    recent_signals?: readonly string[];
  };
}

export interface SafetyResult {
  flag: SafetyEvent["flag"];
  reason: string;
  suggested_action: SafetyEvent["suggested_action"];
  classifier_latency_ms: number;
}

export interface AIAdapter {
  generateSmartSummary(input: SmartSummaryInput): Promise<SmartSummaryOutput>;
  generateEnrichment(input: EnrichmentInput): Promise<SessionSummaryV2Enriched>;
  runSafetyClassifier(input: SafetyInput): Promise<SafetyResult>;
}
